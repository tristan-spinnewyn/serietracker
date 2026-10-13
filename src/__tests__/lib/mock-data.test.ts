import { describe, it, expect } from 'vitest';
import {
  PALETTES,
  USERS,
  ME,
  PROVIDERS,
  SHOWS,
  NOW_WATCHING,
  PLAN_TO_WATCH,
  RECENTLY_FINISHED,
  BINGE_CATCHUP,
  BINGE_DISCOVER,
  USER_PROVIDERS,
  ACTIVITY,
  UPCOMING,
  CAL_EPS,
  LISTS,
  DETAIL_S1,
} from '@/lib/mock-data';

describe('mock-data integrity', () => {
  it('contient des palettes valides', () => {
    expect(PALETTES.length).toBeGreaterThan(0);
    PALETTES.forEach(p => {
      expect(p).toHaveLength(3);
    });
  });

  it('contient un utilisateur ME égal au premier utilisateur', () => {
    expect(ME).toEqual(USERS[0]);
  });

  it('fournit des providers valides', () => {
    expect(Object.keys(PROVIDERS)).toContain('netflix');
    expect(Object.keys(PROVIDERS)).toContain('crunchyroll');
  });

  it('fournit des listes de shows cohérentes', () => {
    expect(SHOWS.length).toBeGreaterThan(0);
    expect(NOW_WATCHING.length).toBeGreaterThan(0);
    expect(PLAN_TO_WATCH.length).toBeGreaterThan(0);
    expect(RECENTLY_FINISHED.length).toBeGreaterThan(0);
    expect(BINGE_CATCHUP.length).toBeGreaterThan(0);
    expect(BINGE_DISCOVER.length).toBeGreaterThan(0);
    expect(USER_PROVIDERS).toContain('netflix');
    expect(ACTIVITY.length).toBeGreaterThan(0);
    expect(UPCOMING.length).toBeGreaterThan(0);
    expect(Object.keys(CAL_EPS).length).toBeGreaterThan(0);
    expect(LISTS.length).toBeGreaterThan(0);
    expect(DETAIL_S1.show).toBeDefined();
    expect(DETAIL_S1.seasons.length).toBeGreaterThan(0);
  });
});
