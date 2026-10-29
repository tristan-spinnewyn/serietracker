// Genre / season filters for browsing AniList beyond a title search.
// No server imports here: the search page uses these constants too.

// AniList's GenreCollection, minus adult-only genres
export const ANIME_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror',
  'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance',
  'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
] as const;

export const ANIME_SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'] as const;
export type AnimeSeason = typeof ANIME_SEASONS[number];

export interface AnimeSearchFilters {
  genres?: string[];
  season?: AnimeSeason;
  seasonYear?: number;
  /** Only anime that have finished airing */
  finishedOnly?: boolean;
}

const MIN_SEASON_YEAR = 1940;

/** The AniList season airing on `date`: winter is January to March, and so on. */
export function currentAnimeSeason(date = new Date()): { season: AnimeSeason; seasonYear: number } {
  return { season: ANIME_SEASONS[Math.floor(date.getMonth() / 3)], seasonYear: date.getFullYear() };
}

function isValidSeasonYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_SEASON_YEAR && year <= new Date().getFullYear() + 2;
}

/** Reads the filters from the query string, dropping any value AniList would not know. */
export function parseAnimeSearchFilters(params: URLSearchParams): AnimeSearchFilters {
  const filters: AnimeSearchFilters = {};

  const genres = params.getAll('genre').filter(g => (ANIME_GENRES as readonly string[]).includes(g));
  if (genres.length) filters.genres = genres;

  const season = params.get('season');
  if (season && (ANIME_SEASONS as readonly string[]).includes(season)) filters.season = season as AnimeSeason;

  const seasonYear = Number(params.get('seasonYear'));
  if (params.has('seasonYear') && isValidSeasonYear(seasonYear)) filters.seasonYear = seasonYear;

  if (params.get('finished') === 'true') filters.finishedOnly = true;

  return filters;
}

export function hasAnimeSearchFilters(filters: AnimeSearchFilters): boolean {
  return !!filters.genres?.length || !!filters.season || filters.seasonYear !== undefined || !!filters.finishedOnly;
}

/** Writes the filters into `params`, in the format parseAnimeSearchFilters reads. */
export function toAnimeSearchParams(filters: AnimeSearchFilters, params: URLSearchParams): void {
  filters.genres?.forEach(g => params.append('genre', g));
  if (filters.season) params.set('season', filters.season);
  if (filters.seasonYear !== undefined) params.set('seasonYear', String(filters.seasonYear));
  if (filters.finishedOnly) params.set('finished', 'true');
}
