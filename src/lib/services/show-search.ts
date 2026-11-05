import { searchTmdb, type TmdbSearchResult } from '@/lib/tmdb/client';
import { searchAnilist, type AnilistSearchResult } from '@/lib/anilist/client';
import { hasAnimeSearchFilters, type AnimeSearchFilters } from '@/lib/anilist/search-filters';
import type { MediaType } from '@prisma/client';

export type ShowSearchResult = TmdbSearchResult | AnilistSearchResult;

const valueOrEmpty = <T>(settled: PromiseSettledResult<T[]>): T[] =>
  settled.status === 'fulfilled' ? settled.value : [];

/**
 * Searches TMDB (series) and AniList (anime) only — the local catalog is
 * never queried. Anime filters (genre, season…) only exist on AniList, so
 * they skip TMDB. When one API fails, the other's results are still returned.
 */
export async function searchShows(
  q: string,
  type: MediaType | null,
  animeFilters: AnimeSearchFilters = {},
): Promise<{ results: ShowSearchResult[] }> {
  const searchesSeries = type !== 'ANIME' && !hasAnimeSearchFilters(animeFilters);
  const searchesAnime = type !== 'SERIES';

  const [tmdb, anilist] = await Promise.allSettled([
    searchesSeries ? searchTmdb(q) : Promise.resolve([]),
    searchesAnime ? searchAnilist(q, animeFilters) : Promise.resolve([]),
  ]);

  return { results: [...valueOrEmpty<ShowSearchResult>(tmdb), ...valueOrEmpty<ShowSearchResult>(anilist)] };
}
