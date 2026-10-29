import { describe, it, expect } from 'vitest';
import {
  ANIME_GENRES,
  ANIME_SEASONS,
  parseAnimeSearchFilters,
  hasAnimeSearchFilters,
  toAnimeSearchParams,
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
    });
  });

  describe('toAnimeSearchParams', () => {
    it('writes the filters back into query params that parse to the same filters', () => {
      const filters = { genres: ['Action', 'Drama'], season: 'SPRING' as const, seasonYear: 2024 };
      const params = new URLSearchParams();
      toAnimeSearchParams(filters, params);
      expect(params.toString()).toBe('genre=Action&genre=Drama&season=SPRING&seasonYear=2024');
      expect(parseAnimeSearchFilters(params)).toEqual(filters);
    });

    it('leaves the params untouched when no filter is set', () => {
      const params = new URLSearchParams('q=x');
      toAnimeSearchParams({}, params);
      expect(params.toString()).toBe('q=x');
    });
  });
});
