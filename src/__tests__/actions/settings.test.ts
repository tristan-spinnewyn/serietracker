import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuth, mockUpdate, mockFindUniqueOrThrow, mockCompare, mockHash, mockRevalidatePath } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindUniqueOrThrow: vi.fn(),
  mockCompare: vi.fn(),
  mockHash: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      update: mockUpdate,
      findUniqueOrThrow: mockFindUniqueOrThrow,
    },
  },
}));
vi.mock('bcryptjs', () => ({
  compare: mockCompare,
  hash: mockHash,
}));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

import { updateProfile, updatePassword, updatePlatforms } from '@/lib/actions/settings';

describe('settings actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateProfile', () => {
    it('lève une erreur si l\'utilisateur n\'est pas authentifié', async () => {
      mockAuth.mockResolvedValue(null);
      await expect(updateProfile({ name: 'Bob', color: '#ff0000' })).rejects.toThrow('Non authentifié');
    });

    it('met à jour le profil avec nom, couleur et initiales', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      mockUpdate.mockResolvedValue({});

      const res = await updateProfile({ name: 'Alice Martin', color: '#123456' });
      expect(res).toEqual({ success: true });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { name: 'Alice Martin', color: '#123456', initials: 'AM' },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');
    });
  });

  describe('updatePassword', () => {
    it('retourne une erreur si le mot de passe actuel est erroné', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      mockFindUniqueOrThrow.mockResolvedValue({ passwordHash: 'hash-actuel' });
      mockCompare.mockResolvedValue(false);

      const res = await updatePassword({ current: 'wrong', next: 'newpassword123' });
      expect(res).toEqual({ error: 'Mot de passe actuel incorrect.' });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('met à jour le hash quand le mot de passe actuel est valide', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      mockFindUniqueOrThrow.mockResolvedValue({ passwordHash: 'hash-actuel' });
      mockCompare.mockResolvedValue(true);
      mockHash.mockResolvedValue('hash-nouveau');
      mockUpdate.mockResolvedValue({});

      const res = await updatePassword({ current: 'correct', next: 'newpassword123' });
      expect(res).toEqual({ success: true });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'u1' },
        // Bumping the version invalidates every JWT issued before the change
        data: { passwordHash: 'hash-nouveau', sessionVersion: { increment: 1 } },
      });
    });
  });

  describe('updatePlatforms', () => {
    it('met à jour la liste des plateformes et revalide', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      mockUpdate.mockResolvedValue({});

      const res = await updatePlatforms(['netflix', 'crunchyroll']);
      expect(res).toEqual({ success: true });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { platforms: ['netflix', 'crunchyroll'] },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');
    });

    it('removes duplicate platforms', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      mockUpdate.mockResolvedValue({});

      await updatePlatforms(['netflix', 'netflix']);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { platforms: ['netflix'] },
      });
    });

    it.each([
      ['an unknown platform', ['netflix', 'not-a-provider']],
      ['a non-array payload', 'netflix'],
      ['non-string values', [42]],
    ])('rejects %s', async (_label, platforms) => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      // @ts-expect-error -- server actions receive untrusted input at runtime
      await expect(updatePlatforms(platforms)).rejects.toThrow();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});
