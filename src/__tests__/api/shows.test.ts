import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockAuth,
  mockShowFindMany,
  mockUserFindUnique,
  mockSearchTmdb,
  mockSearchAnilist,
  mockImportShowFromTmdb,
  mockImportShowFromAnilist,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockShowFindMany: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockSearchTmdb: vi.fn(),
  mockSearchAnilist: vi.fn(),
  mockImportShowFromTmdb: vi.fn(),
  mockImportShowFromAnilist: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    show: { findMany: mockShowFindMany },
    user: { findUnique: mockUserFindUnique },
  },
}));
vi.mock('@/lib/tmdb/client', () => ({ searchTmdb: mockSearchTmdb }));
vi.mock('@/lib/anilist/client', () => ({ searchAnilist: mockSearchAnilist }));
vi.mock('@/lib/sync/import-show', () => ({
  importShowFromTmdb: mockImportShowFromTmdb,
  importShowFromAnilist: mockImportShowFromAnilist,
}));

import { GET as searchGet } from '@/app/api/shows/search/route';
import { GET as catalogGet } from '@/app/api/shows/catalog/route';
import { POST as importPost } from '@/app/api/shows/import/route';
import { resetRateLimits } from '@/lib/rate-limit';

describe('/api/shows/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockSearchTmdb.mockResolvedValue([]);
    mockSearchAnilist.mockResolvedValue([]);
  });

  const search = async (query: string) =>
    (await searchGet(new NextRequest(`http://localhost/api/shows/search?${query}`))).json();

  it('renvoie 401 si non connecté', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await searchGet(new NextRequest('http://localhost/api/shows/search?q=test'));
    expect(res.status).toBe(401);
  });

  it('returns no results when the search text is shorter than 2 characters', async () => {
    expect(await search('q=a')).toEqual({ results: [] });
    expect(mockSearchTmdb).not.toHaveBeenCalled();
    expect(mockSearchAnilist).not.toHaveBeenCalled();
  });

  it('only queries TMDB and AniList, never the local catalog', async () => {
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 100, title: 'Arcane' }, { tmdbId: 101, title: 'Archer' }]);
    mockSearchAnilist.mockResolvedValue([{ anilistId: 50, title: 'Arc Anime' }]);

    const body = await search('q=Arc');

    expect(mockSearchTmdb).toHaveBeenCalledWith('Arc');
    expect(mockSearchAnilist).toHaveBeenCalledWith('Arc', {});
    expect(mockShowFindMany).not.toHaveBeenCalled();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(body.results.map((r: { title: string }) => r.title)).toEqual(['Arcane', 'Archer', 'Arc Anime']);
  });

  it('keeps the results of one API when the other fails', async () => {
    mockSearchTmdb.mockRejectedValue(new Error('TMDB down'));
    mockSearchAnilist.mockResolvedValue([{ anilistId: 50, title: 'Arc Anime' }]);

    const body = await search('q=Arc');

    expect(body.results).toEqual([{ anilistId: 50, title: 'Arc Anime' }]);
  });

  it('only asks TMDB for series and AniList for anime', async () => {
    await search('q=Arc&type=SERIES');
    expect(mockSearchTmdb).toHaveBeenCalled();
    expect(mockSearchAnilist).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mockSearchAnilist.mockResolvedValue([]);
    await search('q=Arc&type=ANIME');
    expect(mockSearchTmdb).not.toHaveBeenCalled();
    expect(mockSearchAnilist).toHaveBeenCalled();
  });

  describe('anime filters', () => {
    it('browses AniList by genre and season without a search text, and never queries TMDB', async () => {
      mockSearchAnilist.mockResolvedValue([{ anilistId: 1, title: 'Fall Hit' }]);

      const body = await search('genre=Action&season=FALL&seasonYear=2026');

      expect(mockSearchAnilist).toHaveBeenCalledWith('', { genres: ['Action'], season: 'FALL', seasonYear: 2026 });
      expect(mockSearchTmdb).not.toHaveBeenCalled();
      expect(mockShowFindMany).not.toHaveBeenCalled();
      expect(body.results.map((r: { title: string }) => r.title)).toEqual(['Fall Hit']);
    });

    it('combines the search text with the filters', async () => {
      await search('q=Ti&genre=Drama');
      expect(mockSearchAnilist).toHaveBeenCalledWith('Ti', { genres: ['Drama'] });
    });
  });
});

describe('/api/shows/catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
  });

  const catalog = (query: string) => catalogGet(new NextRequest(`http://localhost/api/shows/catalog?${query}`));

  it('renvoie 401 si non connecté', async () => {
    mockAuth.mockResolvedValue(null);
    expect((await catalog('q=Arc')).status).toBe(401);
  });

  it('returns no shows when the search text is shorter than 2 characters', async () => {
    expect(await (await catalog('q=a')).json()).toEqual({ shows: [] });
    expect(mockShowFindMany).not.toHaveBeenCalled();
  });

  it('searches the local catalog by title, without calling the external APIs', async () => {
    mockShowFindMany.mockResolvedValue([{ id: 's1', title: 'Arcane' }]);

    const body = await (await catalog('q=%20Arc%20')).json();

    expect(body).toEqual({ shows: [{ id: 's1', title: 'Arcane' }] });
    expect(mockShowFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { title: { contains: 'Arc', mode: 'insensitive' } },
      take: 20,
    }));
    expect(mockSearchTmdb).not.toHaveBeenCalled();
    expect(mockSearchAnilist).not.toHaveBeenCalled();
  });
});

describe('/api/shows/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
  });

  it('returns 429 with Retry-After after 30 imports in a minute', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockImportShowFromTmdb.mockResolvedValue({ id: 'show-1' });
    const importOnce = () => importPost(new NextRequest('http://localhost/api/shows/import', {
      method: 'POST',
      body: JSON.stringify({ tmdbId: 1234 }),
    }));

    for (let i = 0; i < 30; i++) await importOnce();
    mockImportShowFromTmdb.mockClear();

    const res = await importOnce();
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(mockImportShowFromTmdb).not.toHaveBeenCalled();
  });

  it('renvoie 401 si non connecté', async () => {
    mockAuth.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/shows/import', {
      method: 'POST',
      body: JSON.stringify({ tmdbId: 123 }),
    });
    const res = await importPost(req);
    expect(res.status).toBe(401);
  });

  it('renvoie 400 si le payload est invalide', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const req = new NextRequest('http://localhost/api/shows/import', {
      method: 'POST',
      body: JSON.stringify({ bad: 'data' }),
    });
    const res = await importPost(req);
    expect(res.status).toBe(400);
  });

  it('importe via TMDB avec succès', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockImportShowFromTmdb.mockResolvedValue({ id: 'imported-tmdb' });

    const req = new NextRequest('http://localhost/api/shows/import', {
      method: 'POST',
      body: JSON.stringify({ tmdbId: 1234 }),
    });
    const res = await importPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: 'imported-tmdb' });
  });

  it('importe via AniList avec succès', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockImportShowFromAnilist.mockResolvedValue({ id: 'imported-anilist' });

    const req = new NextRequest('http://localhost/api/shows/import', {
      method: 'POST',
      body: JSON.stringify({ anilistId: 5678 }),
    });
    const res = await importPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: 'imported-anilist' });
  });

  it('renvoie 502 si l\'import échoue', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockImportShowFromTmdb.mockRejectedValue(new Error('API indisponible'));

    const req = new NextRequest('http://localhost/api/shows/import', {
      method: 'POST',
      body: JSON.stringify({ tmdbId: 1234 }),
    });
    const res = await importPost(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Impossible d'importer ce titre pour le moment.");
    expect(JSON.stringify(body)).not.toContain('API indisponible');
  });
});
