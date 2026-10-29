import { describe, it, expect } from 'vitest';
import {
  ANIME_GENRES,
  ANIME_SEASONS,
  parseAnimeSearchFilters,
  hasAnimeSearchFilters,
  toAnimeSearchParams,
  currentAnimeSeason,
} from '@/lib/anilist/search-filters';

describe('anime search filters', () => {
  it('exposes the AniList genres and the four seasons', () => {
    expect(ANIME_GENRES).toContain('Action');
    expect(ANIME_GENRES).toContain('Slice of Life');
    expect(ANIME_SEASONS).toEqual(['WINTER', 'SPRING', 'SUMMER', 'FALL']);
  });

  describe('parseAnimeSearchFilters', () => {
    it('reads genres, season and year from the query string', () => {
      const params = new URLSearchParams('genre=Action&genre=Drama&season=FALL&seasonYear=2026');
      expect(parseAnimeSearchFilters(params)).toEqual({
        genres: ['Action', 'Drama'],
        season: 'FALL',
        seasonYear: 2026,
      });
    });

    it('returns no filters when none are given', () => {
      expect(parseAnimeSearchFilters(new URLSearchParams('q=Titan'))).toEqual({});
    });

    it('drops unknown genres, unknown seasons and invalid years', () => {
      const params = new URLSearchParams('genre=Nope&genre=Comedy&season=AUTUMN&seasonYear=abc');
      expect(parseAnimeSearchFilters(params)).toEqual({ genres: ['Comedy'] });
    });

    it('reads the finished-only flag', () => {
      expect(parseAnimeSearchFilters(new URLSearchParams('finished=true'))).toEqual({ finishedOnly: true });
      expect(parseAnimeSearchFilters(new URLSearchParams('finished=no'))).toEqual({});
    });

    it('rejects years outside a plausible range', () => {
      expect(parseAnimeSearchFilters(new URLSearchParams('seasonYear=1800'))).toEqual({});
      expect(parseAnimeSearchFilters(new URLSearchParams('seasonYear=3000'))).toEqual({});
    });
  });

  describe('hasAnimeSearchFilters', () => {
    it('is false for empty filters', () => {
      expect(hasAnimeSearchFilters({})).toBe(false);
      expect(hasAnimeSearchFilters({ genres: [] })).toBe(false);
    });

    it('is true as soon as one filter is set', () => {
      expect(hasAnimeSearchFilters({ genres: ['Action'] })).toBe(true);
      expect(hasAnimeSearchFilters({ season: 'WINTER' })).toBe(true);
      expect(hasAnimeSearchFilters({ seasonYear: 2025 })).toBe(true);
      expect(hasAnimeSearchFilters({ finishedOnly: true })).toBe(true);
    });
  });

  describe('currentAnimeSeason', () => {
    it.each([
      ['2026-01-15', 'WINTER'],
      ['2026-03-31', 'WINTER'],
      ['2026-04-01', 'SPRING'],
      ['2026-07-10', 'SUMMER'],
      ['2026-10-29', 'FALL'],
      ['2026-12-31', 'FALL'],
    ])('maps %s to the %s season of that year', (date, season) => {
      expect(currentAnimeSeason(new Date(`${date}T12:00:00`))).toEqual({ season, seasonYear: 2026 });
    });
  });

  describe('toAnimeSearchParams', () => {
    it('writes the filters back into query params that parse to the same filters', () => {
      const filters = { genres: ['Action', 'Drama'], season: 'SPRING' as const, seasonYear: 2024, finishedOnly: true };
      const params = new URLSearchParams();
      toAnimeSearchParams(filters, params);
      expect(params.toString()).toBe('genre=Action&genre=Drama&season=SPRING&seasonYear=2024&finished=true');
      expect(parseAnimeSearchFilters(params)).toEqual(filters);
    });

    it('leaves the params untouched when no filter is set', () => {
      const params = new URLSearchParams('q=x');
      toAnimeSearchParams({}, params);
      expect(params.toString()).toBe('q=x');
    });
  });
});
