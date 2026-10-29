import { describe, it, expect, vi, beforeEach } from 'vitest';

// Loose signatures to call NextAuth callbacks and providers with partial test inputs
type TestCallback<R> = (params: object, request?: Request) => R;
interface TestToken { id?: string; sessionVersion?: number }
interface CapturedConfig {
  providers: { options?: { authorize?: TestCallback<Promise<unknown>> }; authorize?: TestCallback<Promise<unknown>> }[];
  callbacks: { jwt: TestCallback<Promise<TestToken | null>> };
}
const asCallback = <R,>(fn: unknown) => fn as TestCallback<R>;

const { getConfig, setConfig, mockFindUnique, mockCompare } = vi.hoisted(() => {
  let cfg: CapturedConfig | null = null;
  return {
    getConfig: () => cfg!,
    setConfig: (val: CapturedConfig) => { cfg = val; },
    mockFindUnique: vi.fn(),
    mockCompare: vi.fn(),
  };
});

vi.mock('next-auth', () => ({
  CredentialsSignin: class extends Error { code = 'credentials'; },
  default: vi.fn((cfg) => {
    setConfig(cfg);
    return {
      handlers: { GET: vi.fn(), POST: vi.fn() },
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
  }),
}));

vi.mock('bcryptjs', () => ({
  compare: (...args: unknown[]) => mockCompare(...args),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { authConfig } from '@/lib/auth.config';
import '@/lib/auth';
import { resetRateLimits } from '@/lib/rate-limit';

describe('authConfig callbacks', () => {
  const { authorized, jwt, session } = authConfig.callbacks!;

  describe('authorized', () => {
    it('autorise les routes publiques sans session', () => {
      const publicPaths = ['/login', '/register', '/api/auth/session', '/api/health'];
      for (const p of publicPaths) {
        const allowed = asCallback<boolean>(authorized)({
          auth: null,
          request: { nextUrl: { pathname: p } },
        });
        expect(allowed).toBe(true);
      }
    });

    it('autorise les routes privées avec une session utilisateur', () => {
      const allowed = asCallback<boolean>(authorized)({
        auth: { user: { id: 'u1' } },
        request: { nextUrl: { pathname: '/dashboard' } },
      });
      expect(allowed).toBe(true);
    });

    it('refuse les routes privées sans session', () => {
      const allowed = asCallback<boolean>(authorized)({
        auth: null,
        request: { nextUrl: { pathname: '/dashboard' } },
      });
      expect(allowed).toBe(false);
    });
  });

  describe('jwt callback', () => {
    it('ajoute user.id au token si user est présent', () => {
      const token = asCallback<TestToken>(jwt)({ token: {}, user: { id: 'user-123' } });
      expect(token.id).toBe('user-123');
    });

    it('retourne le token intact si user est absent', () => {
      const token = asCallback<TestToken>(jwt)({ token: { id: 'existing' } });
      expect(token.id).toBe('existing');
    });
  });

  describe('session callback', () => {
    it('attache token.id à session.user.id', () => {
      const sess = asCallback<{ user: { id?: string } }>(session)({
        session: { user: {} },
        token: { id: 'user-456' },
      });
      expect(sess.user.id).toBe('user-456');
    });

    it('ne modifie pas session.user.id si token.id est absent', () => {
      const sess = asCallback<{ user: { id?: string } }>(session)({
        session: { user: {} },
        token: {},
      });
      expect(sess.user.id).toBeUndefined();
    });
  });
});

describe('NextAuth credentials provider authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
  });

  const getAuthorize = () => {
    const prov = getConfig().providers[0];
    return (prov.options?.authorize ?? prov.authorize)!;
  };

  it('rejette des identifiants invalides (zod)', async () => {
    const authorize = getAuthorize();
    const res = await authorize({ email: 'bad-email', password: 'short' });
    expect(res).toBeNull();
  });

  it('retourne null si l\'utilisateur n\'existe pas en base', async () => {
    mockFindUnique.mockResolvedValue(null);
    const authorize = getAuthorize();
    const res = await authorize({ email: 'test@example.com', password: 'password123' });
    expect(res).toBeNull();
  });

  it('retourne null si le mot de passe est incorrect', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@example.com',
      passwordHash: 'hash',
    });
    mockCompare.mockResolvedValue(false);

    const authorize = getAuthorize();
    const res = await authorize({ email: 'test@example.com', password: 'wrong-password' });
    expect(res).toBeNull();
  });

  it('retourne l\'utilisateur quand les identifiants sont valides', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@example.com',
      name: 'Testeur',
      passwordHash: 'hash',
      sessionVersion: 0,
    });
    mockCompare.mockResolvedValue(true);

    const authorize = getAuthorize();
    const res = await authorize({ email: 'test@example.com', password: 'correctpassword' });
    expect(res).toEqual({
      id: 'u1',
      email: 'test@example.com',
      name: 'Testeur',
      sessionVersion: 0,
    });
  });

  describe('rate limiting', () => {
    const requestFrom = (ip: string) => new Request('http://localhost/api/auth/callback/credentials', {
      headers: { 'x-real-ip': ip },
    });

    it('blocks an email after 10 attempts, whatever its case, without checking the password', async () => {
      mockFindUnique.mockResolvedValue(null);
      const authorize = getAuthorize();
      for (let i = 0; i < 10; i++) {
        await authorize({ email: 'victim@example.com', password: 'password123' }, requestFrom(`10.0.0.${i}`));
      }
      mockFindUnique.mockClear();

      await expect(
        authorize({ email: 'Victim@Example.com', password: 'password123' }, requestFrom('10.0.1.1')),
      ).rejects.toMatchObject({ code: 'rate_limited' });
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('blocks an IP after 30 attempts spread over different emails', async () => {
      mockFindUnique.mockResolvedValue(null);
      const authorize = getAuthorize();
      for (let i = 0; i < 30; i++) {
        await authorize({ email: `user${i}@example.com`, password: 'password123' }, requestFrom('203.0.113.5'));
      }

      await expect(
        authorize({ email: 'other@example.com', password: 'password123' }, requestFrom('203.0.113.5')),
      ).rejects.toMatchObject({ code: 'rate_limited' });
    });
  });
});

describe('server-side jwt callback (session revocation)', () => {
  const jwt = () => getConfig().callbacks.jwt;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores the user id and session version at sign-in without a DB call', async () => {
    const token = await jwt()({ token: {}, user: { id: 'u1', sessionVersion: 3 } });
    expect(token).toEqual({ id: 'u1', sessionVersion: 3 });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('keeps the token while its version matches the database', async () => {
    mockFindUnique.mockResolvedValue({ sessionVersion: 3 });
    const token = await jwt()({ token: { id: 'u1', sessionVersion: 3 } });
    expect(token).toEqual({ id: 'u1', sessionVersion: 3 });
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'u1' }, select: { sessionVersion: true } });
  });

  it('treats tokens issued before versioning as version 0', async () => {
    mockFindUnique.mockResolvedValue({ sessionVersion: 0 });
    const token = await jwt()({ token: { id: 'u1' } });
    expect(token).toEqual({ id: 'u1' });
  });

  it('revokes the token once the password has been changed', async () => {
    mockFindUnique.mockResolvedValue({ sessionVersion: 4 });
    expect(await jwt()({ token: { id: 'u1', sessionVersion: 3 } })).toBeNull();
  });

  it('revokes the token when the user no longer exists', async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await jwt()({ token: { id: 'u1', sessionVersion: 0 } })).toBeNull();
  });
});
