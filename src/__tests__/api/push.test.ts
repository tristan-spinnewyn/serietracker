import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockAuth, mockUpsert, mockDeleteMany, mockFindUnique } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockUpsert: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    pushSubscription: {
      upsert: mockUpsert,
      deleteMany: mockDeleteMany,
      findUnique: mockFindUnique,
    },
  },
}));

import { POST, DELETE } from '@/app/api/push/route';

describe('/api/push', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST (subscribe)', () => {
    it('renvoie 401 si non authentifié', async () => {
      mockAuth.mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/push', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('renvoie 400 si le payload est invalide', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      const req = new NextRequest('http://localhost/api/push', {
        method: 'POST',
        body: JSON.stringify({ endpoint: 'not-a-url' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    const subscribe = (endpoint: string) => POST(new NextRequest('http://localhost/api/push', {
      method: 'POST',
      body: JSON.stringify({ endpoint, keys: { p256dh: 'k', auth: 'a' } }),
    }));

    it.each([
      ['plain http', 'http://fcm.googleapis.com/fcm/send/x'],
      ['a cloud metadata address', 'https://169.254.169.254/latest/meta-data'],
      ['localhost', 'https://localhost:3000/api/admin'],
      ['a lookalike host', 'https://fcm.googleapis.com.evil.example/x'],
      ['an unknown host', 'https://example.com/push'],
    ])('rejects %s as a push endpoint, since the server will POST to it', async (_label, endpoint) => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      const res = await subscribe(endpoint);
      expect(res.status).toBe(400);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it.each([
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/abc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ])('accepts the browser push service %s', async (endpoint) => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      mockFindUnique.mockResolvedValue(null);
      mockUpsert.mockResolvedValue({});
      expect((await subscribe(endpoint)).status).toBe(200);
    });

    it('returns 400 when the body is not valid JSON', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      const req = new NextRequest('http://localhost/api/push', { method: 'POST', body: '{not json' });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 403 and leaves the subscription untouched when the endpoint belongs to another user', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'attacker' } });
      mockFindUnique.mockResolvedValue({ userId: 'victim' });

      const req = new NextRequest('http://localhost/api/push', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/victim',
          keys: { p256dh: 'evil', auth: 'evil' },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('enregistre l\'abonnement push en base et renvoie 200', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      mockFindUnique.mockResolvedValue(null);
      mockUpsert.mockResolvedValue({});

      const req = new NextRequest('http://localhost/api/push', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/test',
          keys: { p256dh: 'key1', auth: 'auth1' },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith({
        where: { endpoint: 'https://fcm.googleapis.com/test' },
        update: { p256dh: 'key1', auth: 'auth1' },
        create: {
          userId: 'u1',
          endpoint: 'https://fcm.googleapis.com/test',
          p256dh: 'key1',
          auth: 'auth1',
        },
      });
    });
  });

  describe('DELETE (unsubscribe)', () => {
    it('renvoie 401 si non authentifié', async () => {
      mockAuth.mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/push', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: 'https://test.com' }),
      });

      const res = await DELETE(req);
      expect(res.status).toBe(401);
    });

    it('only deletes the subscription when it belongs to the current user', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      mockDeleteMany.mockResolvedValue({ count: 1 });

      const req = new NextRequest('http://localhost/api/push', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: 'https://test.com' }),
      });

      const res = await DELETE(req);
      expect(res.status).toBe(200);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { endpoint: 'https://test.com', userId: 'u1' },
      });
    });

    it.each([
      ['invalid JSON', '{not json'],
      ['missing endpoint', JSON.stringify({})],
      ['non-URL endpoint', JSON.stringify({ endpoint: 'nope' })],
    ])('returns 400 for %s', async (_label, body) => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      const req = new NextRequest('http://localhost/api/push', { method: 'DELETE', body });

      const res = await DELETE(req);
      expect(res.status).toBe(400);
      expect(mockDeleteMany).not.toHaveBeenCalled();
    });
  });
});
