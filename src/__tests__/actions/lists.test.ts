import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAuth,
  mockSharedListCreate,
  mockListMemberFindUnique,
  mockListMemberCreate,
  mockListItemCount,
  mockListItemUpsert,
  mockListItemDelete,
  mockListItemUpdate,
  mockShowRelationUpsert,
  mockUserFindUnique,
  mockTransaction,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockSharedListCreate: vi.fn(),
  mockListMemberFindUnique: vi.fn(),
  mockListMemberCreate: vi.fn(),
  mockListItemCount: vi.fn(),
  mockListItemUpsert: vi.fn(),
  mockListItemDelete: vi.fn(),
  mockListItemUpdate: vi.fn(),
  mockShowRelationUpsert: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockTransaction: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    sharedList: { create: mockSharedListCreate },
    listMember: { findUnique: mockListMemberFindUnique, create: mockListMemberCreate },
    listItem: {
      count: mockListItemCount,
      upsert: mockListItemUpsert,
      delete: mockListItemDelete,
      update: mockListItemUpdate,
    },
    showRelation: { upsert: mockShowRelationUpsert },
    user: { findUnique: mockUserFindUnique },
    $transaction: mockTransaction,
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

import {
  createList,
  addShowToList,
  removeShowFromList,
  linkShows,
  addMemberToList,
  reorderList,
} from '@/lib/actions/lists';

describe('lists actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
  });

  describe('createList', () => {
    it('crée une liste avec créateur comme membre', async () => {
      mockSharedListCreate.mockResolvedValue({ id: 'list-123' });

      const res = await createList({ name: 'Mes animes', emoji: '🌟', color: '#112233' });
      expect(res).toEqual({ id: 'list-123' });
      expect(mockSharedListCreate).toHaveBeenCalledWith({
        data: {
          name: 'Mes animes',
          emoji: '🌟',
          color: '#112233',
          createdById: 'u1',
          members: { create: { userId: 'u1' } },
        },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/lists');
    });

    it('refuse si non authentifié', async () => {
      mockAuth.mockResolvedValue(null);
      await expect(createList({ name: 'Test' })).rejects.toThrow('Non authentifié');
    });
  });

  describe('addShowToList', () => {
    it('rejette si l\'utilisateur n\'est pas membre de la liste', async () => {
      mockListMemberFindUnique.mockResolvedValue(null);
      await expect(addShowToList('list-1', 'show-1')).rejects.toThrow('Accès refusé');
    });

    it('ajoute le show avec position calculée', async () => {
      mockListMemberFindUnique.mockResolvedValue({ id: 'mem-1' });
      mockListItemCount.mockResolvedValue(3);
      mockListItemUpsert.mockResolvedValue({});

      await addShowToList('list-1', 'show-1');
      expect(mockListItemUpsert).toHaveBeenCalledWith({
        where: { listId_showId: { listId: 'list-1', showId: 'show-1' } },
        update: {},
        create: { listId: 'list-1', showId: 'show-1', addedById: 'u1', position: 3 },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/lists');
    });
  });

  describe('removeShowFromList', () => {
    it('supprime un show si l\'utilisateur est membre', async () => {
      mockListMemberFindUnique.mockResolvedValue({ id: 'mem-1' });
      mockListItemDelete.mockResolvedValue({});

      await removeShowFromList('list-1', 'show-1');
      expect(mockListItemDelete).toHaveBeenCalledWith({
        where: { listId_showId: { listId: 'list-1', showId: 'show-1' } },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/lists');
    });
  });

  describe('linkShows', () => {
    it('crée les relations bidirectionnelles avec transaction', async () => {
      mockTransaction.mockResolvedValue([{}, {}]);
      const res = await linkShows('showA', 'showB', 'SEQUEL');
      expect(res).toEqual({ success: true });
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('addMemberToList', () => {
    it('refuse si l\'invitant n\'est pas membre', async () => {
      mockListMemberFindUnique.mockResolvedValue(null);
      const res = await addMemberToList('list-1', 'friend@test.com');
      expect(res).toEqual({ error: 'Accès refusé.' });
    });

    it('refuse si l\'utilisateur cible est introuvable', async () => {
      mockListMemberFindUnique.mockResolvedValue({ id: 'mem-1' });
      mockUserFindUnique.mockResolvedValue(null);
      const res = await addMemberToList('list-1', 'ghost@test.com');
      expect(res).toEqual({ error: 'Aucun compte trouvé avec cet email.' });
    });

    it('refuse si l\'utilisateur s\'invite lui-même', async () => {
      mockListMemberFindUnique.mockResolvedValue({ id: 'mem-1' });
      mockUserFindUnique.mockResolvedValue({ id: 'u1', name: 'Moi' });
      const res = await addMemberToList('list-1', 'me@test.com');
      expect(res).toEqual({ error: 'Tu es déjà membre de cette liste.' });
    });

    it('refuse si l\'utilisateur est déjà membre', async () => {
      mockListMemberFindUnique.mockResolvedValueOnce({ id: 'mem-1' }); // invitant
      mockUserFindUnique.mockResolvedValue({ id: 'u2', name: 'Ami' });
      mockListMemberFindUnique.mockResolvedValueOnce({ id: 'mem-2' }); // déjà membre
      const res = await addMemberToList('list-1', 'friend@test.com');
      expect(res).toEqual({ error: 'Ami est déjà membre.' });
    });

    it('ajoute le membre avec succès', async () => {
      mockListMemberFindUnique.mockResolvedValueOnce({ id: 'mem-1' });
      mockUserFindUnique.mockResolvedValue({ id: 'u2', name: 'Ami' });
      mockListMemberFindUnique.mockResolvedValueOnce(null);
      mockListMemberCreate.mockResolvedValue({});

      const res = await addMemberToList('list-1', 'friend@test.com');
      expect(res).toEqual({ success: true, name: 'Ami' });
      expect(mockListMemberCreate).toHaveBeenCalledWith({
        data: { listId: 'list-1', userId: 'u2' },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/lists');
    });
  });

  describe('reorderList', () => {
    it('met à jour les positions dans une transaction', async () => {
      mockListMemberFindUnique.mockResolvedValue({ id: 'mem-1' });
      mockTransaction.mockResolvedValue([{}, {}]);

      await reorderList('list-1', ['show-2', 'show-1']);
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith('/lists');
    });
  });
});
