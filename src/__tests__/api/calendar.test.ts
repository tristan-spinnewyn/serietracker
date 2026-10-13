import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockAuth, mockFindMany } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    episode: {
      findMany: mockFindMany,
    },
  },
}));

import { GET } from '@/app/api/calendar/route';

describe('GET /api/calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renvoie 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/calendar?year=2026&month=5');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('renvoie { episodes: [] } si year ou month est manquant', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const req = new NextRequest('http://localhost/api/calendar');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ episodes: [] });
  });

  it('récupère et mappe les épisodes pour le mois demandé', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFindMany.mockResolvedValue([
      {
        id: 'ep-1',
        number: 3,
        airDate: '2026-05-10T20:00:00.000Z',
        season: {
          number: 2,
          show: {
            id: 's1',
            title: 'Série Test',
            type: 'SERIES',
            userShows: [{ notifyEnabled: false }],
          },
        },
      },
    ]);

    const req = new NextRequest('http://localhost/api/calendar?year=2026&month=5&scope=me');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.episodes).toHaveLength(1);
    expect(body.episodes[0]).toEqual({
      id: 'ep-1',
      showId: 's1',
      showTitle: 'Série Test',
      showType: 'SERIES',
      seasonNumber: 2,
      episodeNumber: 3,
      airDate: '2026-05-10T20:00:00.000Z',
      notifyEnabled: false,
    });
  });
});
