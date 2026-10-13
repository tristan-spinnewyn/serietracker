import { describe, it, expect, vi } from 'vitest';

const { getCallback, setCallback } = vi.hoisted(() => {
  let cb: any = null;
  return {
    getCallback: () => cb,
    setCallback: (fn: any) => { cb = fn; },
  };
});

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    auth: vi.fn((fn) => {
      setCallback(fn);
      return fn;
    }),
  })),
}));

import { config } from '@/proxy';

describe('proxy middleware', () => {
  it('exporte la configuration matcher attendue', () => {
    expect(config.matcher).toBeDefined();
    expect(config.matcher[0]).toContain('_next/static');
  });

  it('laisse passer les routes publiques sans authentification', () => {
    const middlewareCallback = getCallback();
    const publicPaths = ['/login', '/register', '/api/auth/providers', '/api/health', '/api/cron/sync-shows'];
    for (const pathname of publicPaths) {
      const req = {
        nextUrl: { pathname },
        url: `https://example.com${pathname}`,
        auth: null,
      };
      const res = middlewareCallback(req);
      expect(res.status).not.toBe(401);
      expect(res.headers.get('location')).toBeNull();
    }
  });

  it('renvoie JSON 401 pour les routes /api/ non authentifiées', async () => {
    const middlewareCallback = getCallback();
    const req = {
      nextUrl: { pathname: '/api/shows/search' },
      url: 'https://example.com/api/shows/search',
      auth: null,
    };
    const res = middlewareCallback(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('redirige vers /login avec callbackUrl pour les pages non authentifiées', () => {
    const middlewareCallback = getCallback();
    const req = {
      nextUrl: { pathname: '/dashboard' },
      url: 'https://example.com/dashboard',
      auth: null,
    };
    const res = middlewareCallback(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login?callbackUrl=%2Fdashboard');
  });

  it('laisse passer les requêtes privées quand l\'utilisateur est authentifié', () => {
    const middlewareCallback = getCallback();
    const req = {
      nextUrl: { pathname: '/dashboard' },
      url: 'https://example.com/dashboard',
      auth: { user: { id: 'u1' } },
    };
    const res = middlewareCallback(req);
    expect(res.status).toBe(200);
  });
});
