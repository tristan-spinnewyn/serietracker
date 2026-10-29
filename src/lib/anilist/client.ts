import type { ShowStatus } from '@prisma/client';
import { gql, getLastAnilistError } from '@/lib/anilist/gql';
import {
  stripHtml, buildAnilistEpisodes, mapAnilistStatus, parseAnilistProviders, parseAnilistProviderLinks,
  type AnilistEpisode,
} from '@/lib/anilist/mappers';
import { hasAnimeSearchFilters, type AnimeSearchFilters } from '@/lib/anilist/search-filters';

// Public API of the AniList integration (queries + re-exported helpers)
export { getLastAnilistError } from '@/lib/anilist/gql';
export * from '@/lib/anilist/mappers';

export interface AnilistSearchResult {
  anilistId: number;
  title: string;
  originalTitle: string | null;
  type: 'ANIME';
  year: number | null;
  posterPath: string | null;
  overview: string | null;
}

export interface AnilistShowDetail extends AnilistSearchResult {
  status: ShowStatus;
  network: string | null;
  genre: string | null;
  runtime: number | null;
  totalSeasons: number;
  backdropPath: string | null;
  providers: string[];
  providerLinks: Record<string, string>;
  episodes: AnilistEpisode[];
  relations: AnilistRelation[];
}

export interface AnilistRelation {
  anilistId: number;
  title: string;
  type: 'ANIME' | 'MANGA' | 'OTHER';
  relationType: 'SEQUEL' | 'PREQUEL' | 'SIDE_STORY' | 'ALTERNATIVE' | 'PARENT' | 'OTHER';
  posterUrl: string | null;
}

/**
 * Searches AniList by title, by genre / season, or both. Without a title,
 * results are sorted by popularity and a larger page is returned.
 */
export async function searchAnilist(q: string, filters: AnimeSearchFilters = {}): Promise<AnilistSearchResult[]> {
  const query = `
    query ($search: String, $genres: [String], $season: MediaSeason, $seasonYear: Int, $sort: [MediaSort], $perPage: Int) {
      Page(perPage: $perPage) {
        media(search: $search, genre_in: $genres, season: $season, seasonYear: $seasonYear, sort: $sort, type: ANIME) {
          id
          title { romaji english native }
          coverImage { large }
          startDate { year }
          description(asHtml: false)
        }
      }
    }
  `;

  const browsing = hasAnimeSearchFilters(filters);
  // Unset variables are left out so AniList ignores the matching argument
  const variables: Record<string, unknown> = {
    ...(q ? { search: q } : {}),
    ...(filters.genres?.length ? { genres: filters.genres } : {}),
    ...(filters.season ? { season: filters.season } : {}),
    ...(filters.seasonYear !== undefined ? { seasonYear: filters.seasonYear } : {}),
    ...(q ? {} : { sort: ['POPULARITY_DESC'] }),
    perPage: browsing ? 30 : 10,
  };

  const data = await gql<{ Page: { media: unknown[] } }>(query, variables);
  if (!data) return [];

  return (data.Page?.media ?? []).map((m: unknown) => {
    const media = m as Record<string, unknown>;
    const title = media.title as Record<string, string>;
    const coverImage = media.coverImage as Record<string, string>;
    const startDate = media.startDate as Record<string, number>;
    return {
      anilistId: media.id as number,
      title: title.english ?? title.romaji,
      originalTitle: title.romaji ?? null,
      type: 'ANIME' as const,
      year: startDate?.year ?? null,
      posterPath: coverImage?.large ?? null,
      overview: stripHtml(media.description as string),
    };
  });
}

export async function fetchAnilistDetail(anilistId: number): Promise<AnilistShowDetail | null> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english native }
        status
        episodes
        duration
        coverImage { extraLarge }
        bannerImage
        description(asHtml: false)
        genres
        studios(isMain: true) { nodes { name } }
        startDate { year }
        airingSchedule(notYetAired: false, perPage: 50) {
          nodes { episode airingAt }
        }
        externalLinks { site type url }
        relations {
          edges {
            relationType
            node {
              id
              type
              title { english romaji }
              coverImage { large }
            }
          }
        }
      }
    }
  `;

  const data = await gql<{ Media: Record<string, unknown> }>(query, { id: anilistId });
  const m = data?.Media;
  if (!m) return null;

  const title = m.title as Record<string, string>;
  const coverImage = m.coverImage as Record<string, string>;
  const startDate = m.startDate as Record<string, number>;
  const airingSchedule = m.airingSchedule as { nodes: { episode: number; airingAt: number }[] };
  const totalEpisodes = m.episodes as number | null;

  const episodes = buildAnilistEpisodes(airingSchedule?.nodes, totalEpisodes);

  const KEPT_RELATIONS = new Set(['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'ALTERNATIVE', 'PARENT']);
  const relationsRaw = (m.relations as { edges: { relationType: string; node: Record<string, unknown> }[] })?.edges ?? [];
  const relations: AnilistRelation[] = relationsRaw
    .filter(e => KEPT_RELATIONS.has(e.relationType) && e.node.type === 'ANIME')
    .map(e => {
      const t = e.node.title as Record<string, string>;
      const img = e.node.coverImage as Record<string, string>;
      return {
        anilistId: e.node.id as number,
        title: t.english ?? t.romaji,
        type: 'ANIME' as const,
        relationType: e.relationType as AnilistRelation['relationType'],
        posterUrl: img?.large ?? null,
      };
    });

  const rawLinks = m.externalLinks as Array<{ site: string; type: string; url?: string }> ?? [];
  const providers = parseAnilistProviders(rawLinks);
  const providerLinks = parseAnilistProviderLinks(rawLinks);

  return {
    anilistId,
    title: title.english ?? title.romaji,
    originalTitle: title.romaji ?? null,
    type: 'ANIME',
    year: startDate?.year ?? null,
    posterPath: coverImage?.extraLarge ?? null,
    backdropPath: m.bannerImage as string ?? null,
    overview: stripHtml(m.description as string),
    status: mapAnilistStatus(m.status as string),
    network: (m.studios as { nodes: { name: string }[] })?.nodes?.[0]?.name ?? null,
    genre: (m.genres as string[] ?? []).slice(0, 3).join(' · ') || null,
    runtime: m.duration as number ?? null,
    totalSeasons: 1,
    providers,
    providerLinks,
    episodes,
    relations,
  };
}

// ── Liste utilisateur ────────────────────────────────────────────────────────

export type AnilistWatchStatus = 'CURRENT' | 'COMPLETED' | 'PLANNING' | 'DROPPED' | 'PAUSED' | 'REPEATING';

export interface AnilistListEntry {
  anilistId: number;
  title: string;
  status: AnilistWatchStatus;
  score: number; // 0-100
}

export async function fetchAnilistUserList(username: string): Promise<AnilistListEntry[] | null> {
  const query = `
    query ($userName: String) {
      MediaListCollection(userName: $userName, type: ANIME) {
        lists {
          entries {
            status
            score(format: POINT_100)
            media { id title { english romaji } }
          }
        }
      }
    }
  `;

  const data = await gql<{ MediaListCollection: { lists: { entries: unknown[] }[] } | null }>(
    query, { userName: username }
  );
  if (!data) return null;
  if (!data.MediaListCollection) return null;

  const entries: AnilistListEntry[] = [];
  for (const list of data.MediaListCollection.lists) {
    for (const raw of list.entries) {
      const e = raw as Record<string, unknown>;
      const media = e.media as Record<string, unknown>;
      const title = media.title as Record<string, string>;
      entries.push({
        anilistId: media.id as number,
        title: title.english ?? title.romaji,
        status: e.status as AnilistWatchStatus,
        score: (e.score as number) ?? 0,
      });
    }
  }
  return entries;
}

// ── Batch sync (id_in) ────────────────────────────────────────────────────────

export interface AnilistSyncRelation {
  relationType: string;
  node: {
    id: number;
    type: string;
    status: string;
    title: { english?: string; romaji?: string };
  };
}

export interface AnilistSyncData {
  id: number;
  status: string;
  title: { english?: string; romaji?: string };
  coverImage?: { extraLarge?: string };
  bannerImage?: string;
  description?: string;
  episodes?: number | null;
  airingSchedule?: { nodes: Array<{ episode: number; airingAt: number }> };
  externalLinks?: Array<{ site: string; type: string; url?: string }>;
  relations?: { edges: AnilistSyncRelation[] };
}

export class AnilistApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnilistApiError';
  }
}

export async function batchFetchAnilistData(
  ids: number[],
  { throwOnApiFailure = false }: { throwOnApiFailure?: boolean } = {},
): Promise<Map<number, AnilistSyncData>> {
  const result = new Map<number, AnilistSyncData>();
  const CHUNK = 50;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const query = `
      query ($ids: [Int]) {
        Page(perPage: 50) {
          media(id_in: $ids, type: ANIME) {
            id status
            title { english romaji }
            coverImage { extraLarge }
            bannerImage
            description(asHtml: false)
            episodes
            airingSchedule(notYetAired: false, perPage: 50) {
              nodes { episode airingAt }
            }
            externalLinks { site type url }
            relations {
              edges {
                relationType
                node { id type status title { english romaji } }
              }
            }
          }
        }
      }
    `;

    const data = await gql<{ Page: { media: AnilistSyncData[] } }>(query, { ids: chunk });
    // gql() retourne null en cas d'erreur (API désactivée, 403/429 persistants, réseau, etc.)
    if (data === null && throwOnApiFailure) {
      const reason = getLastAnilistError();
      throw new AnilistApiError(
        reason ? `AniList API indisponible — ${reason}` : 'AniList API indisponible (voir logs serveur)',
      );
    }
    for (const media of data?.Page?.media ?? []) {
      result.set(media.id, media);
    }
    // Pas de sleep entre les chunks : gql() gère déjà l'espacement via nextSlotAt
  }

  return result;
}
