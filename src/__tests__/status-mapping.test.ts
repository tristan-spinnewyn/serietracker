import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { mapTmdbStatus } from '@/lib/tmdb/client';
import { mapAnilistStatus } from '@/lib/anilist/client';

describe('mapTmdbStatus', () => {
  it('mappe les statuts TMDB connus', () => {
    expect(mapTmdbStatus('Returning Series')).toBe('RETURNING');
    expect(mapTmdbStatus('Ended')).toBe('ENDED');
    expect(mapTmdbStatus('Canceled')).toBe('CANCELED');
    expect(mapTmdbStatus('In Production')).toBe('IN_PRODUCTION');
    expect(mapTmdbStatus('Planned')).toBe('UPCOMING');
  });

  it('retourne RETURNING pour un statut inconnu', () => {
    expect(mapTmdbStatus('Unknown')).toBe('RETURNING');
    expect(mapTmdbStatus('')).toBe('RETURNING');
  });
});

describe('mapAnilistStatus', () => {
  it('mappe les statuts AniList connus', () => {
    expect(mapAnilistStatus('FINISHED')).toBe('ENDED');
    expect(mapAnilistStatus('RELEASING')).toBe('RETURNING');
    expect(mapAnilistStatus('NOT_YET_RELEASED')).toBe('UPCOMING');
    expect(mapAnilistStatus('CANCELLED')).toBe('CANCELED');
  });

  it('retourne RETURNING pour un statut inconnu', () => {
    expect(mapAnilistStatus('HIATUS')).toBe('RETURNING');
    expect(mapAnilistStatus('')).toBe('RETURNING');
  });
});
