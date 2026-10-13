import { describe, it, expect } from 'vitest';
import { GET, dynamic } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('exporte dynamic force-dynamic', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('retourne { ok: true } avec statut 200', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
