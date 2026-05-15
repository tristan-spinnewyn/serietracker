import type { ShowStatus } from '@prisma/client';

const ENDPOINT = 'https://graphql.anilist.co';
const MIN_INTERVAL_MS = 2000; // dégradé: 30 req/min → 2000ms min

let lastRequestAt = 0;

async function gql<T>(query: string, variables: Record<string, unknown>, attempt = 0): Promise<T | null> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429 && attempt < 3) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return gql(query, variables, attempt + 1);
  }

  if (!res.ok) return null;
  const json = await res.json();
  if (json.errors?.length) return null;
  return json.data ?? null;
}

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

export interface AnilistEpisode {
  number: number;
  airDate: Date | null;
}

// Fusionne airingSchedule + Media.episodes : AniList ne fournit pas toujours
// le schedule complet pour les vieux animes finis. On comble avec des épisodes
// sans airDate pour que le compte total soit correct.
export function buildAnilistEpisodes(
  scheduleNodes: Array<{ episode: number; airingAt: number }> | null | undefined,
  totalEpisodes: number | null | undefined,
): AnilistEpisode[] {
  const byNumber = new Map<number, AnilistEpisode>();
  for (const n of scheduleNodes ?? []) {
    byNumber.set(n.episode, { number: n.episode, airDate: new Date(n.airingAt * 1000) });
  }
  const maxScheduled = byNumber.size ? Math.max(...byNumber.keys()) : 0;
  const total = Math.max(totalEpisodes ?? 0, maxScheduled);
  for (let i = 1; i <= total; i++) {
    if (!byNumber.has(i)) byNumber.set(i, { number: i, airDate: null });
  }
  return Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
}

export interface AnilistRelation {
  anilistId: number;
  title: string;
  type: 'ANIME' | 'MANGA' | 'OTHER';
  relationType: 'SEQUEL' | 'PREQUEL' | 'SIDE_STORY' | 'ALTERNATIVE' | 'PARENT' | 'OTHER';
  posterUrl: string | null;
}

export async function searchAnilist(q: string): Promise<AnilistSearchResult[]> {
  const query = `
    query ($search: String) {
      Page(perPage: 10) {
        media(search: $search, type: ANIME) {
          id
          title { romaji english native }
          coverImage { large }
          startDate { year }
          description(asHtml: false)
        }
      }
    }
  `;

  const data = await gql<{ Page: { media: unknown[] } }>(query, { search: q });
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
      overview: (media.description as string)?.replace(/<[^>]+>/g, '') ?? null,
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
    overview: (m.description as string)?.replace(/<[^>]+>/g, '') ?? null,
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

export function mapAnilistStatus(s: string): ShowStatus {
  const m: Record<string, ShowStatus> = {
    FINISHED: 'ENDED',
    RELEASING: 'RETURNING',
    NOT_YET_RELEASED: 'UPCOMING',
    CANCELLED: 'CANCELED',
  };
  return m[s] ?? 'RETURNING';
}

const ANILIST_SITE_MAP: Record<string, string> = {
  'Crunchyroll':               'crunchyroll',
  'Netflix':                   'netflix',
  'ADN':                       'adn',
  'Animation Digital Network': 'adn',
  'Amazon Prime Video':        'prime',
  'Disney Plus':               'disney',
  'HIDIVE':                    'hidive',
  'Apple TV Plus':             'appletv',
  'Canal+':                    'canal',
};

export function parseAnilistProviders(links: Array<{ site: string; type: string; url?: string }>): string[] {
  const keys = links
    .filter(l => l.type === 'STREAMING')
    .map(l => ANILIST_SITE_MAP[l.site])
    .filter(Boolean) as string[];
  return [...new Set(keys)];
}

export function parseAnilistProviderLinks(links: Array<{ site: string; type: string; url?: string }>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const l of links) {
    if (l.type !== 'STREAMING' || !l.url) continue;
    const key = ANILIST_SITE_MAP[l.site];
    if (key) result[key] = l.url;
  }
  return result;
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

export async function batchFetchAnilistData(ids: number[]): Promise<Map<number, AnilistSyncData>> {
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
    for (const media of data?.Page?.media ?? []) {
      result.set(media.id, media);
    }

    if (i + CHUNK < ids.length) {
      await new Promise(r => setTimeout(r, 700));
    }
  }

  return result;
}
