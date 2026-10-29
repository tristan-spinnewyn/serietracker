import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getConfig, setConfig, mockFindUnique, mockCompare } = vi.hoisted(() => {
  let cfg: any = null;
  return {
    getConfig: () => cfg,
    setConfig: (val: any) => { cfg = val; },
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
        const allowed = (authorized as any)({
          auth: null,
          request: { nextUrl: { pathname: p } },
        });
        expect(allowed).toBe(true);
      }
    });

    it('autorise les routes privées avec une session utilisateur', () => {
      const allowed = (authorized as any)({
        auth: { user: { id: 'u1' } },
        request: { nextUrl: { pathname: '/dashboard' } },
      });
      expect(allowed).toBe(true);
    });

    it('refuse les routes privées sans session', () => {
      const allowed = (authorized as any)({
        auth: null,
        request: { nextUrl: { pathname: '/dashboard' } },
      });
      expect(allowed).toBe(false);
    });
  });

  describe('jwt callback', () => {
    it('ajoute user.id au token si user est présent', () => {
      const token = (jwt as any)({ token: {}, user: { id: 'user-123' } });
      expect(token.id).toBe('user-123');
    });

    it('retourne le token intact si user est absent', () => {
      const token = (jwt as any)({ token: { id: 'existing' } });
      expect(token.id).toBe('existing');
    });
  });

  describe('session callback', () => {
    it('attache token.id à session.user.id', () => {
      const sess = (session as any)({
        session: { user: {} },
        token: { id: 'user-456' },
      });
      expect(sess.user.id).toBe('user-456');
    });

    it('ne modifie pas session.user.id si token.id est absent', () => {
      const sess = (session as any)({
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
    return prov.options?.authorize ?? prov.authorize;
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
    });
    mockCompare.mockResolvedValue(true);

    const authorize = getAuthorize();
    const res = await authorize({ email: 'test@example.com', password: 'correctpassword' });
    expect(res).toEqual({
      id: 'u1',
      email: 'test@example.com',
      name: 'Testeur',
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
