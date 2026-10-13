import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockAuth, mockUpsert, mockDelete } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockUpsert: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    pushSubscription: {
      upsert: mockUpsert,
      delete: mockDelete,
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

    it('enregistre l\'abonnement push en base et renvoie 200', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
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

    it('supprime l\'abonnement et renvoie 200', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      mockDelete.mockResolvedValue({});

      const req = new NextRequest('http://localhost/api/push', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: 'https://test.com' }),
      });

      const res = await DELETE(req);
      expect(res.status).toBe(200);
      expect(mockDelete).toHaveBeenCalledWith({
        where: { endpoint: 'https://test.com' },
      });
    });
  });
});
