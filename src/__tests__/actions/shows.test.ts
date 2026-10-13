import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAuth,
  mockUserShowUpsert,
  mockUserShowDelete,
  mockUserShowUpdate,
  mockUserShowFindMany,
  mockUserShowFindUnique,
  mockEpisodeFindUnique,
  mockEpisodeFindMany,
  mockEpisodeCount,
  mockUserEpisodeUpsert,
  mockUserEpisodeDelete,
  mockUserEpisodeCount,
  mockUserEpisodeCreateMany,
  mockUserEpisodeDeleteMany,
  mockShowFindUnique,
  mockNotificationCreate,
  mockNotificationFindFirst,
  mockTransaction,
  mockRevalidatePath,
  mockSyncShow,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockUserShowUpsert: vi.fn(),
  mockUserShowDelete: vi.fn(),
  mockUserShowUpdate: vi.fn(),
  mockUserShowFindMany: vi.fn(),
  mockUserShowFindUnique: vi.fn(),
  mockEpisodeFindUnique: vi.fn(),
  mockEpisodeFindMany: vi.fn(),
  mockEpisodeCount: vi.fn(),
  mockUserEpisodeUpsert: vi.fn(),
  mockUserEpisodeDelete: vi.fn(),
  mockUserEpisodeCount: vi.fn(),
  mockUserEpisodeCreateMany: vi.fn(),
  mockUserEpisodeDeleteMany: vi.fn(),
  mockShowFindUnique: vi.fn(),
  mockNotificationCreate: vi.fn(),
  mockNotificationFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockSyncShow: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    userShow: {
      upsert: mockUserShowUpsert,
      delete: mockUserShowDelete,
      update: mockUserShowUpdate,
      findMany: mockUserShowFindMany,
      findUnique: mockUserShowFindUnique,
    },
    episode: {
      findUnique: mockEpisodeFindUnique,
      findMany: mockEpisodeFindMany,
      count: mockEpisodeCount,
    },
    userEpisode: {
      upsert: mockUserEpisodeUpsert,
      delete: mockUserEpisodeDelete,
      count: mockUserEpisodeCount,
      createMany: mockUserEpisodeCreateMany,
      deleteMany: mockUserEpisodeDeleteMany,
    },
    show: { findUnique: mockShowFindUnique },
    notification: {
      create: mockNotificationCreate,
      findFirst: mockNotificationFindFirst,
    },
    $transaction: mockTransaction,
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));
vi.mock('@/lib/sync/sync-show', () => ({ syncShow: mockSyncShow }));

import {
  upsertUserShow,
  removeUserShow,
  toggleEpisode,
  resyncShow,
  markEpisodesWatchedBatch,
  markAllCompletedEpisodesWatched,
  markShowAllWatched,
  unmarkShowAllWatched,
  toggleShowNotif,
  rateShow,
} from '@/lib/actions/shows';

describe('shows actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockEpisodeFindMany.mockResolvedValue([]);
  });

  describe('upsertUserShow', () => {
    it('ajoute ou met à jour le statut d\'un show et revalide', async () => {
      mockUserShowUpsert.mockResolvedValue({});

      await upsertUserShow({ showId: 'show-1', status: 'WATCHING' });
      expect(mockUserShowUpsert).toHaveBeenCalledWith({
        where: { userId_showId: { userId: 'u1', showId: 'show-1' } },
        update: { status: 'WATCHING' },
        create: { userId: 'u1', showId: 'show-1', status: 'WATCHING' },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/show/show-1');
    });

    it('refuse si non connecté', async () => {
      mockAuth.mockResolvedValue(null);
      await expect(upsertUserShow({ showId: 's1', status: 'WATCHING' })).rejects.toThrow('Non authentifié');
    });
  });

  describe('removeUserShow', () => {
    it('supprime le show de la liste', async () => {
      mockUserShowDelete.mockResolvedValue({});

      await removeUserShow('show-1');
      expect(mockUserShowDelete).toHaveBeenCalledWith({
        where: { userId_showId: { userId: 'u1', showId: 'show-1' } },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('toggleEpisode', () => {
    it('marque un épisode comme vu, ajoute le show en WATCHING et check completion', async () => {
      mockEpisodeFindUnique.mockResolvedValue({ season: { showId: 'show-1' } });
      mockUserShowUpsert.mockResolvedValue({});
      mockUserEpisodeUpsert.mockResolvedValue({});

      // checkSeasonComplete mock
      mockEpisodeFindMany.mockResolvedValueOnce([
        {
          seasonId: 'season-1',
          season: {
            id: 'season-1',
            number: 1,
            showId: 'show-1',
            show: { title: 'Titre Série' },
            episodes: [{ id: 'ep-1' }],
          },
        },
      ]);
      mockUserEpisodeCount.mockResolvedValueOnce(1); // 1/1 watched in season
      mockNotificationFindFirst.mockResolvedValue(null);
      mockNotificationCreate.mockResolvedValue({});

      // checkShowComplete mock
      mockEpisodeFindMany.mockResolvedValueOnce([
        { season: { showId: 'show-1' } },
      ]);
      mockShowFindUnique.mockResolvedValue({ status: 'ENDED' });
      mockUserShowFindUnique.mockResolvedValue({ status: 'WATCHING' });
      mockEpisodeCount.mockResolvedValue(10);
      mockUserEpisodeCount.mockResolvedValueOnce(10); // 10/10 watched
      mockUserShowUpdate.mockResolvedValue({});

      await toggleEpisode('ep-1', true);

      expect(mockUserEpisodeUpsert).toHaveBeenCalledWith({
        where: { userId_episodeId: { userId: 'u1', episodeId: 'ep-1' } },
        update: {},
        create: { userId: 'u1', episodeId: 'ep-1' },
      });
      expect(mockNotificationCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'SEASON_COMPLETE' }),
      });
      expect(mockUserShowUpdate).toHaveBeenCalledWith({
        where: { userId_showId: { userId: 'u1', showId: 'show-1' } },
        data: { status: 'COMPLETED' },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/show/[id]', 'page');
    });

    it('démarque un épisode comme non vu', async () => {
      mockUserEpisodeDelete.mockResolvedValue({});

      await toggleEpisode('ep-1', false);
      expect(mockUserEpisodeDelete).toHaveBeenCalledWith({
        where: { userId_episodeId: { userId: 'u1', episodeId: 'ep-1' } },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/show/[id]', 'page');
    });
  });

  describe('resyncShow', () => {
    it('déclenche syncShow et revalide', async () => {
      mockSyncShow.mockResolvedValue(undefined);

      await resyncShow('show-1');
      expect(mockSyncShow).toHaveBeenCalledWith('show-1');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/show/show-1');
    });
  });

  describe('markEpisodesWatchedBatch', () => {
    it('ne fait rien si le tableau est vide', async () => {
      await markEpisodesWatchedBatch([]);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('marque plusieurs épisodes en batch via $transaction', async () => {
      mockTransaction.mockResolvedValue([{}, {}]);

      await markEpisodesWatchedBatch(['ep-1', 'ep-2']);
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith('/show/[id]', 'page');
    });
  });

  describe('markAllCompletedEpisodesWatched', () => {
    it('retourne { count: 0 } s\'il n\'y a aucun show COMPLETED', async () => {
      mockUserShowFindMany.mockResolvedValue([]);
      const res = await markAllCompletedEpisodesWatched();
      expect(res).toEqual({ count: 0 });
    });

    it('marque tous les épisodes des shows complétés et renvoie le count', async () => {
      mockUserShowFindMany.mockResolvedValue([{ showId: 's1' }]);
      mockEpisodeFindMany.mockResolvedValue([{ id: 'ep-1' }, { id: 'ep-2' }]);
      mockUserEpisodeCreateMany.mockResolvedValue({ count: 2 });

      const res = await markAllCompletedEpisodesWatched();
      expect(res).toEqual({ count: 2 });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/termine');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('markShowAllWatched', () => {
    it('marque tous les épisodes diffusés d\'un show comme vus', async () => {
      mockUserShowUpsert.mockResolvedValue({});
      mockEpisodeFindMany
        .mockResolvedValueOnce([{ id: 'ep-1' }, { id: 'ep-2' }])
        .mockResolvedValueOnce([
          {
            seasonId: 'season-1',
            season: {
              id: 'season-1',
              number: 1,
              showId: 's1',
              show: { title: 'Série' },
              episodes: [{ id: 'ep-1' }, { id: 'ep-2' }],
            },
          },
        ]);
      mockUserEpisodeCreateMany.mockResolvedValue({ count: 2 });
      mockEpisodeCount.mockResolvedValue(2);
      mockUserShowUpdate.mockResolvedValue({});
      mockUserEpisodeCount.mockResolvedValue(2);
      mockNotificationFindFirst.mockResolvedValue(null);
      mockNotificationCreate.mockResolvedValue({});

      await markShowAllWatched('s1');
      expect(mockUserShowUpdate).toHaveBeenCalledWith({
        where: { userId_showId: { userId: 'u1', showId: 's1' } },
        data: { status: 'COMPLETED' },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/show/s1');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
    });

    it('ne fait rien si aucun épisode n\'a été diffusé', async () => {
      mockUserShowUpsert.mockResolvedValue({});
      mockEpisodeFindMany.mockResolvedValue([]);

      await markShowAllWatched('s1');
      expect(mockUserEpisodeCreateMany).not.toHaveBeenCalled();
    });
  });

  describe('unmarkShowAllWatched', () => {
    it('supprime tous les épisodes vus d\'un show et passe le statut en PLAN_TO_WATCH si COMPLETED', async () => {
      mockEpisodeFindMany.mockResolvedValue([{ id: 'ep-1' }, { id: 'ep-2' }]);
      mockUserEpisodeDeleteMany.mockResolvedValue({ count: 2 });
      mockUserShowFindUnique.mockResolvedValue({ status: 'COMPLETED' });
      mockUserShowUpdate.mockResolvedValue({});

      await unmarkShowAllWatched('s1');

      expect(mockEpisodeFindMany).toHaveBeenCalledWith({
        where: { season: { showId: 's1' } },
        select: { id: true },
      });
      expect(mockUserEpisodeDeleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'u1',
          episodeId: { in: ['ep-1', 'ep-2'] },
        },
      });
      expect(mockUserShowUpdate).toHaveBeenCalledWith({
        where: { userId_showId: { userId: 'u1', showId: 's1' } },
        data: { status: 'PLAN_TO_WATCH' },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/show/s1');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/termine');
    });

    it('passe le statut en PLAN_TO_WATCH si le show était WATCHING', async () => {
      mockEpisodeFindMany.mockResolvedValue([{ id: 'ep-1' }]);
      mockUserEpisodeDeleteMany.mockResolvedValue({ count: 1 });
      mockUserShowFindUnique.mockResolvedValue({ status: 'WATCHING' });
      mockUserShowUpdate.mockResolvedValue({});

      await unmarkShowAllWatched('s1');

      expect(mockUserShowUpdate).toHaveBeenCalledWith({
        where: { userId_showId: { userId: 'u1', showId: 's1' } },
        data: { status: 'PLAN_TO_WATCH' },
      });
    });

    it('ne modifie pas le statut si le show n\'est pas COMPLETED ni WATCHING', async () => {
      mockEpisodeFindMany.mockResolvedValue([{ id: 'ep-1' }]);
      mockUserEpisodeDeleteMany.mockResolvedValue({ count: 1 });
      mockUserShowFindUnique.mockResolvedValue({ status: 'DROPPED' });

      await unmarkShowAllWatched('s1');

      expect(mockUserShowUpdate).not.toHaveBeenCalled();
    });

    it('ne tente pas de supprimer d\'épisodes si le show n\'en a aucun', async () => {
      mockEpisodeFindMany.mockResolvedValue([]);
      mockUserShowFindUnique.mockResolvedValue(null);

      await unmarkShowAllWatched('s1');

      expect(mockUserEpisodeDeleteMany).not.toHaveBeenCalled();
      expect(mockUserShowUpdate).not.toHaveBeenCalled();
    });
  });

  describe('toggleShowNotif', () => {
    it('met à jour notifyEnabled pour le show', async () => {
      mockUserShowUpdate.mockResolvedValue({});

      await toggleShowNotif('s1', true);
      expect(mockUserShowUpdate).toHaveBeenCalledWith({
        where: { userId_showId: { userId: 'u1', showId: 's1' } },
        data: { notifyEnabled: true },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/show/s1');
    });
  });

  describe('rateShow', () => {
    it('enregistre la note arrondie par tranche de 0.5 entre 0 et 5', async () => {
      mockUserShowUpdate.mockResolvedValue({});

      await rateShow('s1', 4.3);
      expect(mockUserShowUpdate).toHaveBeenCalledWith({
        where: { userId_showId: { userId: 'u1', showId: 's1' } },
        data: { rating: 4.5 },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/show/s1');
    });
  });
});
