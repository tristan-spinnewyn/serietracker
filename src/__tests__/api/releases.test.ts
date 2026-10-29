import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockAuth, mockShowFindMany, mockUserShowFindMany } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockShowFindMany: vi.fn(),
  mockUserShowFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    show: { findMany: mockShowFindMany },
    userShow: { findMany: mockUserShowFindMany },
  },
}));

import { GET } from '@/app/api/releases/route';

describe('GET /api/releases', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv, TMDB_READ_ACCESS_TOKEN: 'fake-token' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('renvoie 401 si non connecté', async () => {
    mockAuth.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/releases');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('récupère et croise les sorties films, séries et animes avec les shows locaux', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/movie/now_playing')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                id: 500,
                title: 'Dune 2',
                poster_path: '/dune.jpg',
                backdrop_path: '/dune_b.jpg',
                release_date: '2024-03-01',
                vote_average: 8.5,
                overview: 'Arrakis',
              },
            ],
          }),
        } as Response;
      }
      if (url.includes('/movie/upcoming')) {
        return {
          ok: true,
          json: async () => ({ results: [] }),
        } as Response;
      }
      if (url.includes('/tv/on_the_air')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                id: 600,
                name: 'The Boys',
                poster_path: '/boys.jpg',
                vote_average: 8.1,
                first_air_date: '2024-06-13',
                origin_country: ['US'],
              },
            ],
          }),
        } as Response;
      }
      if (url.includes('graphql.anilist.co')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              Page: {
                media: [
                  {
                    id: 700,
                    title: { english: 'Demon Slayer' },
                    coverImage: { large: '/ds.jpg' },
                    genres: ['Action'],
                    averageScore: 85,
                    episodes: 12,
                    status: 'RELEASING',
                    startDate: { year: 2024, month: 5, day: 12 },
                    nextAiringEpisode: { episode: 4, airingAt: 1717000000 },
                  },
                ],
              },
            },
          }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    // Shows en base
    mockShowFindMany.mockImplementation(async ({ where }: { where: { anilistId?: unknown; tmdbId?: unknown } }) => {
      if (where.anilistId) {
        return [{ id: 'local-ds-id', anilistId: 700 }];
      }
      if (where.tmdbId) {
        return [{ id: 'local-boys-id', tmdbId: 600 }];
      }
      return [];
    });

    // Shows dans la liste de l'user
    mockUserShowFindMany.mockResolvedValue([
      { showId: 'local-ds-id' },
    ]);

    const req = new NextRequest('http://localhost/api/releases?type=all');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.movies).toHaveLength(1);
    expect(body.movies[0].title).toBe('Dune 2');
    expect(body.movies[0].userHasShow).toBe(false);

    expect(body.series).toHaveLength(1);
    expect(body.series[0].title).toBe('The Boys');
    expect(body.series[0].localId).toBe('local-boys-id');
    expect(body.series[0].userHasShow).toBe(false);

    expect(body.anime).toHaveLength(1);
    expect(body.anime[0].title).toBe('Demon Slayer');
    expect(body.anime[0].localId).toBe('local-ds-id');
    expect(body.anime[0].userHasShow).toBe(true);
  });

  it('gère les erreurs et renvoie 500', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockShowFindMany.mockRejectedValue(new Error('Erreur DB inattendue'));
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Crash réseau'));

    const req = new NextRequest('http://localhost/api/releases');
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Erreur serveur');
    expect(JSON.stringify(body)).not.toMatch(/Erreur DB|Crash/);
  });
});
