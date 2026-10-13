import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from '@/lib/fetch';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retourne les données json quand res.ok est vrai', async () => {
    const mockData = { id: 1, name: 'Success' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as unknown as Response);

    const result = await apiFetch<typeof mockData>('/api/test');
    expect(result).toEqual(mockData);
  });

  it('lève une erreur avec le message extrait de res.json() si res.ok est faux', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: 'Mauvaise requête' }),
    } as unknown as Response);

    await expect(apiFetch('/api/bad')).rejects.toThrow('Mauvaise requête');
  });

  it('lève une erreur avec fallback HTTP status si le body n\'est pas du JSON valide', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error (HTML)',
    } as unknown as Response);

    await expect(apiFetch('/api/error')).rejects.toThrow('HTTP 500');
  });

  it('lève une erreur avec fallback si le JSON n\'a pas de propriété error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ message: 'Not found' }),
    } as unknown as Response);

    await expect(apiFetch('/api/missing')).rejects.toThrow('HTTP 404');
  });
});
