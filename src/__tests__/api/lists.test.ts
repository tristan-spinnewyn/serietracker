import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuth, mockFindMany } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    sharedList: {
      findMany: mockFindMany,
    },
  },
}));

import { GET } from '@/app/api/lists/route';

describe('GET /api/lists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renvoie 401 si l\'utilisateur n\'est pas connecté', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('renvoie les listes partagées de l\'utilisateur avec statut 200', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFindMany.mockResolvedValue([
      { id: 'l1', name: 'Liste 1', items: [] },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      lists: [{ id: 'l1', name: 'Liste 1', items: [] }],
    });
  });

  it('gère les erreurs et renvoie statut 500', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFindMany.mockRejectedValue(new Error('Erreur DB'));

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Erreur DB');
  });
});
