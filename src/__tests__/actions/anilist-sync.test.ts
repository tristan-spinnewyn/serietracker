import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAuth,
  mockFindUnique,
  mockCreate,
  mockUpdate,
  mockRevalidatePath,
  mockImportShowFromAnilist,
  mockFetchAnilistUserList,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockImportShowFromAnilist: vi.fn(),
  mockFetchAnilistUserList: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    userShow: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));
vi.mock('@/lib/sync/import-show', () => ({
  importShowFromAnilist: mockImportShowFromAnilist,
}));
vi.mock('@/lib/anilist/client', () => ({
  fetchAnilistUserList: mockFetchAnilistUserList,
}));

import { syncFromAnilist } from '@/lib/actions/anilist-sync';
import { resetRateLimits } from '@/lib/rate-limit';

describe('syncFromAnilist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
  });

  it('renvoie { status: "error" } si non connecté', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await syncFromAnilist('testuser');
    expect(res).toEqual({ status: 'error' });
  });

  it('renvoie { status: "not_found" } si l\'utilisateur AniList est introuvable', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFetchAnilistUserList.mockResolvedValue(null);

    const res = await syncFromAnilist('unknownuser');
    expect(res).toEqual({ status: 'not_found' });
  });

  it('importe et met à jour les séries de la liste AniList', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFetchAnilistUserList.mockResolvedValue([
      { anilistId: 101, title: 'Show 1', status: 'COMPLETED', score: 90 },
      { anilistId: 102, title: 'Show 2', status: 'CURRENT', score: 0 },
    ]);

    mockImportShowFromAnilist.mockImplementation(async (id: number) => ({ id: `show-${id}` }));

    // Show 1 est déjà présent avec priorité inférieure (PLAN_TO_WATCH) -> doit être mis à jour
    mockFindUnique.mockImplementation(async ({ where }: any) => {
      if (where.userId_showId.showId === 'show-101') {
        return { status: 'PLAN_TO_WATCH' };
      }
      return null;
    });

    mockUpdate.mockResolvedValue({});
    mockCreate.mockResolvedValue({});

    const res = await syncFromAnilist('otaku');
    expect(res).toEqual({ status: 'ok', imported: 1, skipped: 1, errors: 0 });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId_showId: { userId: 'u1', showId: 'show-101' } },
      data: { status: 'COMPLETED' },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: { userId: 'u1', showId: 'show-102', status: 'WATCHING' },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings');
  });

  it('incrémente errors si l\'import échoue sur un show', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFetchAnilistUserList.mockResolvedValue([
      { anilistId: 999, title: 'Failed Show', status: 'PLANNING', score: 0 },
    ]);
    mockImportShowFromAnilist.mockRejectedValue(new Error('Import failed'));

    const res = await syncFromAnilist('otaku');
    expect(res).toEqual({ status: 'ok', imported: 0, skipped: 0, errors: 1 });
  });

  it('returns rate_limited after 3 syncs in an hour without calling AniList', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFetchAnilistUserList.mockResolvedValue([]);

    for (let i = 0; i < 3; i++) await syncFromAnilist('otaku');
    mockFetchAnilistUserList.mockClear();

    expect(await syncFromAnilist('otaku')).toEqual({ status: 'rate_limited' });
    expect(mockFetchAnilistUserList).not.toHaveBeenCalled();
  });
});
