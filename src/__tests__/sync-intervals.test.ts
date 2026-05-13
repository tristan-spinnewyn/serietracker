import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mocker les dépendances qui ont des effets de bord à l'import
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/notifications/push', () => ({ sendPushToUser: vi.fn() }));
vi.mock('@/lib/anilist/client', () => ({
  batchFetchAnilistData: vi.fn(),
  parseAnilistProviders: vi.fn(),
  parseAnilistProviderLinks: vi.fn(),
}));

import { nextSyncMs } from '@/lib/sync/sync-show';

const DAY = 86_400_000;

describe('nextSyncMs', () => {
  it('RETURNING → 1 jour (sync quotidien)', () => {
    expect(nextSyncMs('RETURNING')).toBe(1 * DAY);
  });

  it('UPCOMING → 7 jours (annoncé, pas encore diffusé)', () => {
    expect(nextSyncMs('UPCOMING')).toBe(7 * DAY);
  });

  it('IN_PRODUCTION → 30 jours (en production)', () => {
    expect(nextSyncMs('IN_PRODUCTION')).toBe(30 * DAY);
  });

  it('ENDED → 90 jours (terminé, check séquelles rare)', () => {
    expect(nextSyncMs('ENDED')).toBe(90 * DAY);
  });

  it('CANCELED → 90 jours (annulé, check séquelles rare)', () => {
    expect(nextSyncMs('CANCELED')).toBe(90 * DAY);
  });

  it('les shows RETURNING sont synchés plus souvent que ENDED', () => {
    expect(nextSyncMs('RETURNING')).toBeLessThan(nextSyncMs('ENDED'));
  });

  it('les shows UPCOMING sont synchés plus souvent que ENDED', () => {
    expect(nextSyncMs('UPCOMING')).toBeLessThan(nextSyncMs('ENDED'));
  });

  it('retourne toujours une valeur positive', () => {
    const statuses = ['RETURNING', 'UPCOMING', 'IN_PRODUCTION', 'ENDED', 'CANCELED'] as const;
    statuses.forEach(s => expect(nextSyncMs(s)).toBeGreaterThan(0));
  });
});
