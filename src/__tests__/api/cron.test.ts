import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockShowFindMany,
  mockSyncLogCreate,
  mockEpisodeFindMany,
  mockNotificationCreate,
  mockNotificationFindFirst,
  mockSyncShow,
  mockBatchSyncAnilistShows,
  mockSendPushToUser,
} = vi.hoisted(() => ({
  mockShowFindMany: vi.fn(),
  mockSyncLogCreate: vi.fn(),
  mockEpisodeFindMany: vi.fn(),
  mockNotificationCreate: vi.fn(),
  mockNotificationFindFirst: vi.fn(),
  mockSyncShow: vi.fn(),
  mockBatchSyncAnilistShows: vi.fn(),
  mockSendPushToUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    show: { findMany: mockShowFindMany },
    syncLog: { create: mockSyncLogCreate },
    episode: { findMany: mockEpisodeFindMany },
    notification: {
      create: mockNotificationCreate,
      findFirst: mockNotificationFindFirst,
    },
  },
}));

vi.mock('@/lib/sync/sync-show', () => ({
  syncShow: mockSyncShow,
  batchSyncAnilistShows: mockBatchSyncAnilistShows,
}));

vi.mock('@/lib/notifications/push', () => ({
  sendPushToUser: mockSendPushToUser,
}));

import { POST as syncShowsPost } from '@/app/api/cron/sync-shows/route';
import { POST as sendNotifsPost } from '@/app/api/cron/send-notifications/route';

describe('Cron API routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: 'super-secret' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('/api/cron/sync-shows', () => {
    it('renvoie 401 si le header Authorization est invalide', async () => {
      const req = new NextRequest('http://localhost/api/cron/sync-shows', {
        method: 'POST',
        headers: { authorization: 'Bearer bad-secret' },
      });
      const res = await syncShowsPost(req);
      expect(res.status).toBe(401);
    });

    it('exécute les synchronisations TMDB et AniList avec token valide', async () => {
      mockShowFindMany
        .mockResolvedValueOnce([{ id: 'tmdb-1', tmdbId: 10, anilistId: null }]) // TMDB
        .mockResolvedValueOnce([{ id: 'ani-1', tmdbId: null, anilistId: 20 }]); // AniList

      mockBatchSyncAnilistShows.mockResolvedValue({ synced: 1, errors: 0 });
      mockSyncShow.mockResolvedValue(undefined);
      mockSyncLogCreate.mockResolvedValue({});

      const req = new NextRequest('http://localhost/api/cron/sync-shows', {
        method: 'POST',
        headers: { authorization: 'Bearer super-secret' },
      });

      const res = await syncShowsPost(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.synced).toBe(2);
      expect(body.errors).toBe(0);
      expect(mockSyncLogCreate).toHaveBeenCalled();
    });
  });

  describe('/api/cron/send-notifications', () => {
    it('renvoie 401 si token manquant', async () => {
      const req = new NextRequest('http://localhost/api/cron/send-notifications', { method: 'POST' });
      const res = await sendNotifsPost(req);
      expect(res.status).toBe(401);
    });

    it('envoie des notifications pour aujourd\'hui et demain avec déduplication', async () => {
      // today's episodes
      mockEpisodeFindMany.mockResolvedValueOnce([
        {
          id: 'ep-today',
          number: 5,
          title: 'Le grand départ',
          season: {
            number: 1,
            show: {
              id: 's1',
              title: 'Série A',
              userShows: [{ userId: 'u1' }],
            },
          },
        },
      ]);

      // tomorrow's episodes
      mockEpisodeFindMany.mockResolvedValueOnce([
        {
          id: 'ep-tomorrow',
          number: 6,
          season: {
            number: 1,
            show: {
              id: 's2',
              title: 'Série B',
              userShows: [{ userId: 'u1' }],
            },
          },
        },
      ]);

      // deduplication check
      mockNotificationFindFirst.mockResolvedValue(null);
      mockNotificationCreate.mockResolvedValue({});
      mockSendPushToUser.mockResolvedValue({});

      const req = new NextRequest('http://localhost/api/cron/send-notifications', {
        method: 'POST',
        headers: { authorization: 'Bearer super-secret' },
      });

      const res = await sendNotifsPost(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sent).toBe(2);
      expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
      expect(mockSendPushToUser).toHaveBeenCalledTimes(2);
    });
  });
});
