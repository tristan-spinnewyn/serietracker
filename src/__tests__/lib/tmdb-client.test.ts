import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchTmdb, fetchTmdbDetail, fetchTmdbProviders, TMDB_MAX_SEARCH_PAGES } from '@/lib/tmdb/client';

describe('TMDB client', () => {
  const originalEnv = process.env.TMDB_READ_ACCESS_TOKEN;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.TMDB_READ_ACCESS_TOKEN = 'fake-token';
  });

  afterEach(() => {
    process.env.TMDB_READ_ACCESS_TOKEN = originalEnv;
  });

  describe('searchTmdb', () => {
    it('retourne [] si le token TMDB est absent', async () => {
      delete process.env.TMDB_READ_ACCESS_TOKEN;
      const res = await searchTmdb('Breaking Bad');
      expect(res).toEqual([]);
    });

    it('retourne [] si la requête HTTP échoue', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const res = await searchTmdb('Breaking Bad');
      expect(res).toEqual([]);
    });

    it('renvoie les résultats mappés correctement', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 1396,
              name: 'Breaking Bad',
              original_name: 'Breaking Bad',
              first_air_date: '2008-01-20',
              poster_path: '/poster.jpg',
              overview: 'Un prof de chimie...',
            },
            {
              id: 9999,
              original_name: 'Sans titre français',
              first_air_date: '',
              poster_path: null,
              overview: null,
            },
          ],
        }),
      } as Response);

      const results = await searchTmdb('Breaking');
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        tmdbId: 1396,
        title: 'Breaking Bad',
        originalTitle: 'Breaking Bad',
        type: 'SERIES',
        year: 2008,
        posterPath: '/poster.jpg',
        overview: 'Un prof de chimie...',
      });
      expect(results[1].year).toBeNull();
      expect(results[1].title).toBe('Sans titre français');
    });

    const tmdbPage = (page: number, totalPages: number, ids: number[]) => ({
      ok: true,
      json: async () => ({
        page,
        total_pages: totalPages,
        results: ids.map(id => ({ id, name: `Show ${id}`, first_air_date: '', poster_path: null, overview: null })),
      }),
    } as Response);

    it('loads every page of results, not just the first ten', async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        const page = Number(new URL(url).searchParams.get('page'));
        return tmdbPage(page, 3, Array.from({ length: 20 }, (_, i) => page * 100 + i));
      });
      globalThis.fetch = fetchMock;

      const results = await searchTmdb('Show');

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(60);
    });

    it('stops at the page cap on very broad searches', async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        const page = Number(new URL(url).searchParams.get('page'));
        return tmdbPage(page, 500, [page]);
      });
      globalThis.fetch = fetchMock;

      const results = await searchTmdb('a');

      expect(fetchMock).toHaveBeenCalledTimes(TMDB_MAX_SEARCH_PAGES);
      expect(results).toHaveLength(TMDB_MAX_SEARCH_PAGES);
    });

    it('keeps the pages that loaded and drops duplicates across pages', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const page = Number(new URL(url).searchParams.get('page'));
        if (page === 3) return { ok: false, status: 500 } as Response;
        return tmdbPage(page, 3, page === 1 ? [1, 2] : [2, 3]);
      });

      const results = await searchTmdb('Show');

      expect(results.map(r => r.tmdbId)).toEqual([1, 2, 3]);
    });
  });

  describe('fetchTmdbDetail', () => {
    it('retourne null si le token est absent', async () => {
      delete process.env.TMDB_READ_ACCESS_TOKEN;
      const res = await fetchTmdbDetail(1396);
      expect(res).toBeNull();
    });

    it('retourne null si la requête de la série échoue', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const res = await fetchTmdbDetail(1396);
      expect(res).toBeNull();
    });

    it('récupère les détails, saisons (en ignorant s=0), et providers', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/watch/providers')) {
          return {
            ok: true,
            json: async () => ({
              results: {
                FR: {
                  link: 'https://justwatch.com/fr/show',
                  flatrate: [{ provider_id: 8 }], // Netflix
                  free: [{ provider_id: 493 }],    // Arte
                },
              },
            }),
          } as Response;
        }

        if (url.includes('/season/1')) {
          return {
            ok: true,
            json: async () => ({
              episodes: [
                {
                  episode_number: 1,
                  name: 'Pilot',
                  overview: 'First episode',
                  runtime: 58,
                  air_date: '2008-01-20',
                  still_path: '/still.jpg',
                },
              ],
            }),
          } as Response;
        }

        if (url.includes('/tv/1396')) {
          return {
            ok: true,
            json: async () => ({
              name: 'Breaking Bad',
              original_name: 'Breaking Bad',
              first_air_date: '2008-01-20',
              poster_path: '/poster.jpg',
              backdrop_path: '/backdrop.jpg',
              overview: 'Overview',
              status: 'Ended',
              number_of_seasons: 1,
              genres: [{ name: 'Drame' }, { name: 'Crime' }],
              networks: [{ name: 'AMC' }],
              episode_run_time: [47],
              seasons: [
                { season_number: 0, name: 'Specials' },
                { season_number: 1, name: 'Saison 1', air_date: '2008-01-20', poster_path: '/s1.jpg' },
              ],
            }),
          } as Response;
        }

        return { ok: false } as Response;
      });

      const detail = await fetchTmdbDetail(1396);
      expect(detail).not.toBeNull();
      expect(detail?.title).toBe('Breaking Bad');
      expect(detail?.genre).toBe('Drame · Crime');
      expect(detail?.network).toBe('AMC');
      expect(detail?.runtime).toBe(47);
      expect(detail?.status).toBe('ENDED');
      expect(detail?.providers).toEqual(['netflix', 'arte']);
      expect(detail?.providerLinks.netflix).toBe('https://justwatch.com/fr/show');
      expect(detail?.seasons).toHaveLength(1);
      expect(detail?.seasons[0].number).toBe(1);
      expect(detail?.seasons[0].episodes).toHaveLength(1);
      expect(detail?.seasons[0].episodes[0].title).toBe('Pilot');
    });

    it('gère l\'absence de providers FR et l\'échec de requête providers', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/watch/providers')) {
          return {
            ok: true,
            json: async () => ({ results: {} }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            name: 'Show sans FR',
            status: 'Returning Series',
            seasons: [],
          }),
        } as Response;
      });

      const detail = await fetchTmdbDetail(123);
      expect(detail?.providers).toEqual([]);
      expect(detail?.providerLinks).toEqual({});
    });
  });

  describe('fetchTmdbProviders', () => {
    it('maps French streaming providers and links each one to the JustWatch page', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: { FR: { link: 'https://justwatch.com/fr/x', flatrate: [{ provider_id: 8 }, { provider_id: 9999 }], free: [{ provider_id: 8 }] } },
        }),
      });

      expect(await fetchTmdbProviders(42)).toEqual({
        providers: ['netflix'],
        providerLinks: { netflix: 'https://justwatch.com/fr/x' },
      });
    });

    it.each([
      ['the request fails', () => Promise.resolve({ ok: false })],
      ['TMDB has no French data', () => Promise.resolve({ ok: true, json: async () => ({ results: {} }) })],
      ['the network errors', () => Promise.reject(new Error('offline'))],
    ])('returns null when %s, so callers can keep their current providers', async (_label, impl) => {
      globalThis.fetch = vi.fn().mockImplementation(impl);
      expect(await fetchTmdbProviders(42)).toBeNull();
    });
  });
});
