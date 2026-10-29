import { describe, it, expect } from 'vitest';
import { findNextUnwatched, countWatched, estimatedRuntime } from '@/lib/shows/progress';

const season = (number: number, episodeNumbers: number[]) => ({
  number,
  episodes: episodeNumbers.map(n => ({ id: `s${number}e${n}`, number: n })),
});

describe('findNextUnwatched', () => {
  it('returns the first unwatched episode in season then episode order, whatever the input order', () => {
    const seasons = [season(2, [2, 1]), season(1, [3, 1, 2])];
    const watched = new Set(['s1e1', 's1e2']);

    expect(findNextUnwatched(seasons, watched)).toEqual({ id: 's1e3', number: 3, seasonNumber: 1 });
  });

  it('does not reorder the caller\'s arrays', () => {
    const seasons = [season(2, [1]), season(1, [2, 1])];
    findNextUnwatched(seasons, new Set());
    expect(seasons.map(s => s.number)).toEqual([2, 1]);
    expect(seasons[1].episodes.map(e => e.number)).toEqual([2, 1]);
  });

  it('returns null once everything is watched', () => {
    expect(findNextUnwatched([season(1, [1])], new Set(['s1e1']))).toBeNull();
  });
});

describe('countWatched', () => {
  it('counts the episodes present in the watched set', () => {
    expect(countWatched([{ id: 'a' }, { id: 'b' }, { id: 'c' }], new Set(['a', 'c', 'z']))).toBe(2);
  });
});

describe('estimatedRuntime', () => {
  it('uses the show runtime when known, otherwise a default per type', () => {
    expect(estimatedRuntime({ runtime: 52, type: 'SERIES' })).toBe(52);
    expect(estimatedRuntime({ runtime: null, type: 'ANIME' })).toBe(24);
    expect(estimatedRuntime({ runtime: null, type: 'SERIES' })).toBe(45);
  });
});
