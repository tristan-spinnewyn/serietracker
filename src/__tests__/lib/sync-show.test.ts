import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindUniqueOrThrow = vi.fn();
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockSeasonUpsert = vi.fn();
const mockEpisodeUpsert = vi.fn();
const mockNotificationCreateMany = vi.fn();
const mockUserShowUpsert = vi.fn();
const mockShowRelationUpsert = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    show: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    userShow: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      upsert: (...args: unknown[]) => mockUserShowUpsert(...args),
    },
    season: {
      upsert: (...args: unknown[]) => mockSeasonUpsert(...args),
    },
    episode: {
      upsert: (...args: unknown[]) => mockEpisodeUpsert(...args),
    },
    notification: {
      createMany: (...args: unknown[]) => mockNotificationCreateMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    showRelation: {
      upsert: (...args: unknown[]) => mockShowRelationUpsert(...args),
    },
  },
}));

const mockSendPush = vi.fn();
vi.mock('@/lib/notifications/push', () => ({
  sendPushToUser: (...args: unknown[]) => mockSendPush(...args),
}));

const mockBatchFetchAnilistData = vi.fn();
vi.mock('@/lib/anilist/client', () => ({
  batchFetchAnilistData: (...args: unknown[]) => mockBatchFetchAnilistData(...args),
  parseAnilistProviders: vi.fn().mockReturnValue(['crunchyroll']),
  parseAnilistProviderLinks: vi.fn().mockReturnValue({ crunchyroll: 'https://cr' }),
  buildAnilistEpisodes: vi.fn().mockReturnValue([{ number: 1, airDate: new Date('2024-01-01') }]),
  stripHtml: vi.fn((s) => s),
}));

import { syncShow, batchSyncAnilistShows } from '@/lib/sync/sync-show';

describe('syncShow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TMDB_READ_ACCESS_TOKEN = 'token';
  });

  it('synchronise un anime AniList avec succès', async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'show-ani-1',
      title: 'Frieren',
      anilistId: 101,
      tmdbId: null,
      status: 'RETURNING',
      totalSeasons: 1,
    });

    const mockMediaMap = new Map();
    mockMediaMap.set(101, {
      id: 101,
      status: 'FINISHED',
      title: { english: 'Frieren' },
      description: 'Histoire',
      episodes: 28,
      externalLinks: [],
      relations: {
        edges: [],
      },
    });
    mockBatchFetchAnilistData.mockResolvedValue(mockMediaMap);
    mockFindUnique.mockResolvedValue({ id: 'show-ani-1', title: 'Frieren' });
    mockFindMany.mockResolvedValue([]); // subscribers
    mockUpdate.mockResolvedValue({});
    mockSeasonUpsert.mockResolvedValue({ id: 'season-1' });
    mockEpisodeUpsert.mockResolvedValue({});

    await syncShow('show-ani-1');

    expect(mockBatchFetchAnilistData).toHaveBeenCalledWith([101], { throwOnApiFailure: true });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('synchronise une série TMDB avec succès et notifie les nouvelles saisons', async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'show-tmdb-1',
      title: 'Severance',
      tmdbId: 200,
      anilistId: null,
      status: 'RETURNING',
      totalSeasons: 1,
    });

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/tv/200/watch/providers')) {
        return {
          ok: true,
          json: async () => ({ results: { FR: { flatrate: [{ provider_id: 350 }] } } }),
        } as Response;
      }
      if (url.includes('/season/2')) {
        return {
          ok: true,
          json: async () => ({
            episodes: [{ episode_number: 1, name: 'S2E1', runtime: 50, air_date: '2025-01-10' }],
          }),
        } as Response;
      }
      if (url.includes('/tv/200')) {
        return {
          ok: true,
          json: async () => ({
            name: 'Severance',
            status: 'Returning Series',
            number_of_seasons: 2,
            overview: 'Lumon',
            seasons: [
              { season_number: 1, name: 'S1' },
              { season_number: 2, name: 'S2', air_date: '2025-01-10' },
            ],
          }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    mockFindMany.mockImplementation(async (args: any) => {
      if (args?.where?.notifyEnabled) {
        return [{ userId: 'user-sub-1' }];
      }
      return [];
    });

    mockSeasonUpsert.mockResolvedValue({ id: 's2' });
    mockEpisodeUpsert.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    mockNotificationCreateMany.mockResolvedValue({});
    mockSendPush.mockResolvedValue({});

    await syncShow('show-tmdb-1');

    expect(mockNotificationCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'user-sub-1',
          type: 'NEW_SEASON',
          title: 'Severance',
        }),
      ],
    });
    expect(mockSendPush).toHaveBeenCalledWith('user-sub-1', expect.anything());
  });
});

describe('batchSyncAnilistShows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renvoie {synced: 0, errors: 0} si la liste de shows est vide', async () => {
    const res = await batchSyncAnilistShows([]);
    expect(res).toEqual({ synced: 0, errors: 0 });
  });

  it('traite les shows du batch et comptabilise synced et errors', async () => {
    const shows = [
      { id: 's1', title: 'Show 1', anilistId: 10, status: 'RETURNING', totalSeasons: 1 } as any,
      { id: 's2', title: 'Show 2', anilistId: 20, status: 'RETURNING', totalSeasons: 1 } as any,
    ];

    const dataMap = new Map();
    dataMap.set(10, {
      id: 10,
      status: 'FINISHED',
      title: { english: 'Show 1' },
      episodes: 12,
    });
    // show 20 n'est pas dans la dataMap -> doit compter comme une erreur
    mockBatchFetchAnilistData.mockResolvedValue(dataMap);
    mockFindMany.mockResolvedValue([]);
    mockSeasonUpsert.mockResolvedValue({ id: 'season-1' });
    mockEpisodeUpsert.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});

    const res = await batchSyncAnilistShows(shows);
    expect(res.synced).toBe(1);
    expect(res.errors).toBe(1);
  });
});
