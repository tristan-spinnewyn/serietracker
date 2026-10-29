import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockSeasonCreate = vi.fn();
const mockSeasonUpsert = vi.fn();
const mockEpisodeUpsert = vi.fn();
const mockRelationUpsert = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    show: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    season: {
      create: (...args: unknown[]) => mockSeasonCreate(...args),
      upsert: (...args: unknown[]) => mockSeasonUpsert(...args),
    },
    episode: {
      upsert: (...args: unknown[]) => mockEpisodeUpsert(...args),
    },
    showRelation: {
      upsert: (...args: unknown[]) => mockRelationUpsert(...args),
    },
  },
}));

const mockFetchTmdbDetail = vi.fn();
vi.mock('@/lib/tmdb/client', () => ({
  fetchTmdbDetail: (...args: unknown[]) => mockFetchTmdbDetail(...args),
}));

const mockFetchAnilistDetail = vi.fn();
vi.mock('@/lib/anilist/client', () => ({
  fetchAnilistDetail: (...args: unknown[]) => mockFetchAnilistDetail(...args),
}));

import { importShowFromTmdb, importShowFromAnilist } from '@/lib/sync/import-show';

describe('importShowFromTmdb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renvoie le show existant sans appel TMDB si déjà en base', async () => {
    const existing = { id: 's1', tmdbId: 100, title: 'Existing' };
    mockFindUnique.mockResolvedValue(existing);

    const result = await importShowFromTmdb(100);
    expect(result).toEqual(existing);
    expect(mockFetchTmdbDetail).not.toHaveBeenCalled();
  });

  it('lève une erreur si le show est introuvable sur TMDB', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockFetchTmdbDetail.mockResolvedValue(null);

    await expect(importShowFromTmdb(999)).rejects.toThrow('TMDB 999 introuvable');
  });

  it('importe le show et ses saisons/épisodes avec succès', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockFetchTmdbDetail.mockResolvedValue({
      tmdbId: 100,
      title: 'Breaking Bad',
      originalTitle: 'Breaking Bad',
      status: 'ENDED',
      genre: 'Drame',
      network: 'AMC',
      overview: 'Chimie',
      posterPath: '/p.jpg',
      backdropPath: '/b.jpg',
      year: 2008,
      runtime: 47,
      totalSeasons: 1,
      providers: ['netflix'],
      providerLinks: { netflix: 'https://jw' },
      seasons: [
        {
          number: 1,
          title: 'Saison 1',
          year: 2008,
          posterPath: '/s1.jpg',
          episodes: [
            {
              number: 1,
              title: 'Pilot',
              overview: 'Intro',
              runtime: 58,
              airDate: new Date('2008-01-20'),
              stillPath: '/ep1.jpg',
            },
          ],
        },
      ],
    });

    const createdShow = { id: 'show-new-1', title: 'Breaking Bad' };
    mockCreate.mockResolvedValue(createdShow);
    mockSeasonUpsert.mockResolvedValue({ id: 'season-1' });
    mockEpisodeUpsert.mockResolvedValue({});

    const result = await importShowFromTmdb(100);
    expect(result).toEqual(createdShow);
    expect(mockCreate).toHaveBeenCalled();
    expect(mockSeasonUpsert).toHaveBeenCalled();
    expect(mockEpisodeUpsert).toHaveBeenCalled();
  });
});

describe('importShowFromAnilist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renvoie le show existant s\'il est déjà présent en base', async () => {
    const existing = { id: 'ani-1', anilistId: 50 };
    mockFindUnique.mockResolvedValue(existing);

    const result = await importShowFromAnilist(50);
    expect(result).toEqual(existing);
  });

  it('lève une erreur si le show est introuvable sur AniList', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockFetchAnilistDetail.mockResolvedValue(null);

    await expect(importShowFromAnilist(9999)).rejects.toThrow('AniList 9999 introuvable');
  });

  it('détecte un cycle si déjà en cours de visite', async () => {
    mockFindUnique.mockResolvedValue(null);
    const visited = new Set([42]);

    await expect(importShowFromAnilist(42, visited)).rejects.toThrow('Cycle détecté');
  });

  it('importe le show, la saison 1, les épisodes et les relations', async () => {
    mockFindUnique.mockImplementation(async ({ where }: { where: { anilistId?: number } }) => {
      if (where.anilistId === 50) return null;
      if (where.anilistId === 51) return { id: 'rel-show-id', anilistId: 51 };
      return null;
    });

    mockFetchAnilistDetail.mockImplementation(async (id: number) => {
      if (id === 50) {
        return {
          anilistId: 50,
          title: 'Frieren',
          originalTitle: 'Sousou no Frieren',
          status: 'ENDED',
          genre: 'Fantasy',
          network: 'Madhouse',
          overview: 'Elf story',
          posterPath: '/frieren.jpg',
          backdropPath: '/frieren_b.jpg',
          year: 2023,
          runtime: 24,
          totalSeasons: 1,
          providers: ['crunchyroll'],
          providerLinks: { crunchyroll: 'https://cr' },
          episodes: [
            { number: 1, airDate: new Date('2023-10-01') },
          ],
          relations: [
            { anilistId: 51, relationType: 'SEQUEL' },
          ],
        };
      }
      return null;
    });

    const created = { id: 'created-50', anilistId: 50 };
    mockCreate.mockResolvedValue(created);
    mockSeasonCreate.mockResolvedValue({ id: 'season-50' });
    mockEpisodeUpsert.mockResolvedValue({});
    mockRelationUpsert.mockResolvedValue({});

    const res = await importShowFromAnilist(50);
    expect(res).toEqual(created);
    expect(mockSeasonCreate).toHaveBeenCalled();
    expect(mockEpisodeUpsert).toHaveBeenCalled();
    expect(mockRelationUpsert).toHaveBeenCalled();
  });

  it('respecte le flag skipRelations=true sans importer de relations', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockFetchAnilistDetail.mockResolvedValue({
      anilistId: 60,
      title: 'Solo',
      status: 'RETURNING',
      totalSeasons: 1,
      providers: [],
      providerLinks: {},
      episodes: [],
      relations: [{ anilistId: 61, relationType: 'SEQUEL' }],
    });
    mockCreate.mockResolvedValue({ id: 'solo-60' });

    const res = await importShowFromAnilist(60, new Set(), true);
    expect(res).toEqual({ id: 'solo-60' });
    expect(mockRelationUpsert).not.toHaveBeenCalled();
  });
});
