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
import { POST as importPost } from '@/app/api/shows/import/route';
import { resetRateLimits } from '@/lib/rate-limit';

describe('/api/shows/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renvoie 401 si non connecté', async () => {
    mockAuth.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/shows/search?q=test');
    const res = await searchGet(req);
    expect(res.status).toBe(401);
  });

  it('renvoie tableaux vides si la recherche est trop courte (< 2 car)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const req = new NextRequest('http://localhost/api/shows/search?q=a');
    const res = await searchGet(req);
    const body = await res.json();
    expect(body).toEqual({ local: [], remote: [] });
  });

  it('renvoie les résultats locaux et cherche en remote si local < 5', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockShowFindMany.mockResolvedValue([
      { id: 's1', title: 'Arcane', tmdbId: 100, anilistId: null },
    ]);
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 100, title: 'Arcane' },
      { tmdbId: 101, title: 'Archer' },
    ]);
    mockSearchAnilist.mockResolvedValue([
      { anilistId: 50, title: 'Anime' },
    ]);

    const req = new NextRequest('http://localhost/api/shows/search?q=Arc');
    const res = await searchGet(req);
    const body = await res.json();

    expect(body.local).toHaveLength(1);
    // Archer et Anime (Arcane filtré car tmdbId déjà en local)
    expect(body.remote).toHaveLength(2);
    expect(body.remote[0].title).toBe('Archer');
    expect(body.remote[1].title).toBe('Anime');
  });

  it('filtre sur les plateformes de l\'utilisateur si onlyMyPlatforms=true', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockUserFindUnique.mockResolvedValue({ platforms: ['netflix'] });
    mockShowFindMany.mockResolvedValue([]);
    mockSearchTmdb.mockResolvedValue([]);
    mockSearchAnilist.mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/shows/search?q=Show&onlyMyPlatforms=true');
    await searchGet(req);

    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { platforms: true },
    });
    expect(mockShowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providers: { hasSome: ['netflix'] },
        }),
      }),
    );
  });

  describe('anime filters', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    });

    it('browses AniList by genre and season without a search text, and never queries TMDB', async () => {
      mockSearchAnilist.mockResolvedValue([
        { anilistId: 1, title: 'Already here' },
        { anilistId: 2, title: 'New one' },
      ]);
      mockShowFindMany.mockResolvedValue([{ id: 's1', title: 'Already here', tmdbId: null, anilistId: 1 }]);

      const req = new NextRequest('http://localhost/api/shows/search?genre=Action&season=FALL&seasonYear=2026');
      const body = await (await searchGet(req)).json();

      expect(mockSearchAnilist).toHaveBeenCalledWith('', { genres: ['Action'], season: 'FALL', seasonYear: 2026 });
      expect(mockSearchTmdb).not.toHaveBeenCalled();
      expect(body.local.map((s: { id: string }) => s.id)).toEqual(['s1']);
      expect(body.remote.map((r: { title: string }) => r.title)).toEqual(['New one']);
    });

    it('looks up the AniList results in the local catalog instead of matching the title', async () => {
      mockSearchAnilist.mockResolvedValue([{ anilistId: 7, title: 'X' }]);
      mockShowFindMany.mockResolvedValue([]);

      await searchGet(new NextRequest('http://localhost/api/shows/search?q=Ti&genre=Drama'));

      expect(mockSearchAnilist).toHaveBeenCalledWith('Ti', { genres: ['Drama'] });
      expect(mockShowFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ anilistId: { in: [7] } }) }),
      );
    });

    it('skips the local lookup when AniList finds nothing', async () => {
      mockSearchAnilist.mockResolvedValue([]);

      const body = await (await searchGet(new NextRequest('http://localhost/api/shows/search?season=WINTER'))).json();

      expect(mockShowFindMany).not.toHaveBeenCalled();
      expect(body).toEqual({ local: [], remote: [] });
    });

    it('keeps the platform filter on local shows', async () => {
      mockUserFindUnique.mockResolvedValue({ platforms: ['crunchyroll'] });
      mockSearchAnilist.mockResolvedValue([{ anilistId: 3, title: 'Y' }]);
      mockShowFindMany.mockResolvedValue([]);

      await searchGet(new NextRequest('http://localhost/api/shows/search?seasonYear=2025&onlyMyPlatforms=true'));

      expect(mockShowFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ providers: { hasSome: ['crunchyroll'] } }),
        }),
      );
    });
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
