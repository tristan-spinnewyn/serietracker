import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildAnilistEpisodes,
  searchAnilist,
  fetchAnilistDetail,
  fetchAnilistUserList,
  batchFetchAnilistData,
  getLastAnilistError,
  AnilistApiError,
} from '@/lib/anilist/client';

describe('Anilist client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Run delayed callbacks immediately so pacing and retries don't slow the tests
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as unknown as typeof setTimeout);
  });

  describe('buildAnilistEpisodes', () => {
    it('construit la liste d\'épisodes à partir des nœuds planifiés', () => {
      const schedule = [
        { episode: 1, airingAt: 1700000000 },
        { episode: 2, airingAt: 1700604800 },
      ];
      const episodes = buildAnilistEpisodes(schedule, 2);
      expect(episodes).toHaveLength(2);
      expect(episodes[0].number).toBe(1);
      expect(episodes[0].airDate).toEqual(new Date(1700000000 * 1000));
      expect(episodes[1].number).toBe(2);
    });

    it('comble les épisodes manquants avec airDate null jusqu\'au total', () => {
      const schedule = [{ episode: 1, airingAt: 1700000000 }];
      const episodes = buildAnilistEpisodes(schedule, 3);
      expect(episodes).toHaveLength(3);
      expect(episodes[0].airDate).not.toBeNull();
      expect(episodes[1].airDate).toBeNull();
      expect(episodes[2].airDate).toBeNull();
    });

    it('gère une liste vide ou non fournie', () => {
      const episodes = buildAnilistEpisodes(null, 2);
      expect(episodes).toHaveLength(2);
      expect(episodes[0].number).toBe(1);
      expect(episodes[0].airDate).toBeNull();
    });
  });

  describe('searchAnilist', () => {
    it('renvoie une liste vide si la requête GraphQL échoue', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => ({ errors: [{ message: 'Server down', status: 500 }] }),
      } as unknown as Response);

      const res = await searchAnilist('Attack on Titan');
      expect(res).toEqual([]);
      expect(getLastAnilistError()).toContain('Server down');
    });

    it('renvoie les animes trouvés et mappés correctement', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: async () => ({
          data: {
            Page: {
              media: [
                {
                  id: 16498,
                  title: { english: 'Attack on Titan', romaji: 'Shingeki no Kyojin' },
                  coverImage: { large: 'https://img.anilist.co/cover.jpg' },
                  startDate: { year: 2013 },
                  description: 'Humans fight <b>titans</b>',
                },
              ],
            },
          },
        }),
      } as unknown as Response);

      const res = await searchAnilist('Titan');
      expect(res).toHaveLength(1);
      expect(res[0]).toEqual({
        anilistId: 16498,
        title: 'Attack on Titan',
        originalTitle: 'Shingeki no Kyojin',
        type: 'ANIME',
        year: 2013,
        posterPath: 'https://img.anilist.co/cover.jpg',
        overview: 'Humans fight titans',
      });
    });
  });

  describe('fetchAnilistDetail', () => {
    it('renvoie null si l\'anime n\'est pas trouvé', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: async () => ({ data: { Media: null } }),
      } as unknown as Response);

      const res = await fetchAnilistDetail(999999);
      expect(res).toBeNull();
    });

    it('renvoie les détails complets avec relations et diffuseurs', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: async () => ({
          data: {
            Media: {
              id: 101,
              title: { english: 'Frieren', romaji: 'Sousou no Frieren' },
              status: 'FINISHED',
              episodes: 28,
              duration: 24,
              coverImage: { extraLarge: 'https://img/frieren.jpg' },
              bannerImage: 'https://img/banner.jpg',
              description: 'L\'après aventure.',
              genres: ['Aventure', 'Drame', 'Fantasy', 'Tranche de vie'],
              studios: { nodes: [{ name: 'Madhouse' }] },
              startDate: { year: 2023 },
              airingSchedule: { nodes: [{ episode: 1, airingAt: 1696000000 }] },
              externalLinks: [
                { site: 'Crunchyroll', type: 'STREAMING', url: 'https://crunchyroll.com/frieren' },
                { site: 'Twitter', type: 'SOCIAL', url: 'https://x.com/frieren' },
              ],
              relations: {
                edges: [
                  {
                    relationType: 'SEQUEL',
                    node: {
                      id: 102,
                      type: 'ANIME',
                      title: { english: 'Frieren S2', romaji: 'Sousou no Frieren 2' },
                      coverImage: { large: 'https://img/s2.jpg' },
                    },
                  },
                  {
                    relationType: 'MANGA_ORIGINAL',
                    node: {
                      id: 201,
                      type: 'MANGA',
                      title: { romaji: 'Manga' },
                    },
                  },
                ],
              },
            },
          },
        }),
      } as unknown as Response);

      const res = await fetchAnilistDetail(101);
      expect(res).not.toBeNull();
      expect(res?.title).toBe('Frieren');
      expect(res?.status).toBe('ENDED');
      expect(res?.network).toBe('Madhouse');
      expect(res?.genre).toBe('Aventure · Drame · Fantasy');
      expect(res?.providers).toEqual(['crunchyroll']);
      expect(res?.providerLinks).toEqual({ crunchyroll: 'https://crunchyroll.com/frieren' });
      expect(res?.relations).toHaveLength(1);
      expect(res?.relations[0].title).toBe('Frieren S2');
      expect(res?.relations[0].relationType).toBe('SEQUEL');
    });
  });

  describe('fetchAnilistUserList', () => {
    it('renvoie null si MediaListCollection est nul', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: async () => ({ data: { MediaListCollection: null } }),
      } as unknown as Response);

      const res = await fetchAnilistUserList('ghost');
      expect(res).toBeNull();
    });

    it('extrait les entrées de listes utilisateur avec statuts et scores', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: async () => ({
          data: {
            MediaListCollection: {
              lists: [
                {
                  entries: [
                    {
                      status: 'COMPLETED',
                      score: 95,
                      media: { id: 101, title: { english: 'Frieren', romaji: 'Frieren' } },
                    },
                    {
                      status: 'CURRENT',
                      score: 0,
                      media: { id: 102, title: { romaji: 'Jujutsu Kaisen' } },
                    },
                  ],
                },
              ],
            },
          },
        }),
      } as unknown as Response);

      const res = await fetchAnilistUserList('otaku');
      expect(res).toHaveLength(2);
      expect(res?.[0]).toEqual({
        anilistId: 101,
        title: 'Frieren',
        status: 'COMPLETED',
        score: 95,
      });
      expect(res?.[1].title).toBe('Jujutsu Kaisen');
    });
  });

  describe('batchFetchAnilistData', () => {
    it('récupère les médias en batch par chunk', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: async () => ({
          data: {
            Page: {
              media: [
                { id: 1, status: 'RELEASING', title: { english: 'Show 1' } },
                { id: 2, status: 'FINISHED', title: { english: 'Show 2' } },
              ],
            },
          },
        }),
      } as unknown as Response);

      const map = await batchFetchAnilistData([1, 2]);
      expect(map.size).toBe(2);
      expect(map.get(1)?.title.english).toBe('Show 1');
      expect(map.get(2)?.status).toBe('FINISHED');
    });

    it('lance AnilistApiError si throwOnApiFailure est activé et que l\'appel échoue', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => ({ errors: [{ message: 'GraphQL down' }] }),
      } as unknown as Response);

      await expect(
        batchFetchAnilistData([1], { throwOnApiFailure: true })
      ).rejects.toThrow(AnilistApiError);
    });
  });
});
