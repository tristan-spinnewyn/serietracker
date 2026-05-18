import type { ShowStatus } from '@prisma/client';

const ENDPOINT = 'https://graphql.anilist.co';
// AniList est en mode dégradé : 30 req/min annoncé (au lieu de 90).
// 60_000 / 2_000 = 30 req/min max → on tient pile dans la limite, sans burst.
// Doc : https://docs.anilist.co/guide/rate-limiting
const MIN_INTERVAL_MS = 2000;
const LOW_REMAINING_THRESHOLD = 5; // backoff proactif quand on s'approche de la limite

// nextSlotAt = timestamp ms du prochain envoi autorisé.
// On le réserve AVANT le fetch → race-safe entre callers concurrents (cron + resync manuel + import).
let nextSlotAt = 0;

interface AnilistGqlError {
  message?: string;
  status?: number;
  locations?: unknown;
}
interface AnilistGqlResponse<T> {
  data?: T | null;
  errors?: AnilistGqlError[];
}

function formatAnilistErrors(errors: AnilistGqlError[] | undefined): string {
  if (!errors?.length) return '';
  return errors
    .map(e => `[${e.status ?? '?'}] ${(e.message ?? '(no message)').trim()}`)
    .join(' | ');
}

async function gql<T>(query: string, variables: Record<string, unknown>, attempt = 0): Promise<T | null> {
  const now = Date.now();
  const mySlot = Math.max(now, nextSlotAt);
  nextSlotAt = mySlot + MIN_INTERVAL_MS;
  if (mySlot > now) await new Promise(r => setTimeout(r, mySlot - now));

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // Cloudflare devant graphql.anilist.co renvoie 403 aux requêtes sans UA identifiable
      'User-Agent': 'SeriesTracker/1.0 (+self-hosted)',
    },
    body: JSON.stringify({ query, variables }),
  });

  // Backoff proactif : si on s'approche de la limite, on saute jusqu'au reset
  const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') ?? '', 10);
  const resetTs = parseInt(res.headers.get('X-RateLimit-Reset') ?? '', 10);
  if (!Number.isNaN(remaining) && remaining <= LOW_REMAINING_THRESHOLD && resetTs > 0) {
    const resetAtMs = resetTs * 1000 + 500;
    if (resetAtMs > nextSlotAt) nextSlotAt = resetAtMs;
  }

  // AniList renvoie le message d'erreur dans le corps même en cas de 4xx
  // (API suspendue, IP bloquée, rate limit, syntax error…). On parse toujours.
  let body: AnilistGqlResponse<T> | null = null;
  let rawText: string | null = null;
  try {
    body = await res.json() as AnilistGqlResponse<T>;
  } catch {
    try { rawText = await res.text(); } catch { /* abandon */ }
  }

  const errors = body?.errors;
  if (errors?.length) {
    console.error(`[AniList] HTTP ${res.status} — ${formatAnilistErrors(errors)}`);
  } else if (!res.ok) {
    console.error(`[AniList] HTTP ${res.status} — ${rawText?.slice(0, 300) ?? '(no body)'}`);
  }

  // 429 (rate limit) et 403 (Cloudflare bot/anti-flood ou API suspendue) sont retentables
  if ((res.status === 429 || res.status === 403) && attempt < 3) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '0', 10);
    const delayMs =
      resetTs > 0       ? Math.max(0, resetTs * 1000 - Date.now()) + 500 :
      retryAfter > 0    ? retryAfter * 1000 :
      /* fallback */      2000 * (attempt + 1);
    await new Promise(r => setTimeout(r, delayMs));
    return gql(query, variables, attempt + 1);
  }

  if (!res.ok) return null;

  // Cas défensif : AniList peut renvoyer HTTP 200 avec un 429 dans le corps GraphQL
  if (errors?.some(e => e.status === 429) && attempt < 3) {
    await new Promise(r => setTimeout(r, 60_000));
    return gql(query, variables, attempt + 1);
  }

  if (errors?.length) return null;
  return body?.data ?? null;
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
    // gql() retourne null après épuisement des retries (403/429 persistants ou erreur réseau)
    if (data === null && throwOnApiFailure) {
      throw new AnilistApiError('AniList API indisponible (Cloudflare 403/429 après 3 retries)');
    }
    for (const media of data?.Page?.media ?? []) {
      result.set(media.id, media);
    }
    // Pas de sleep entre les chunks : gql() gère déjà l'espacement via nextSlotAt
  }

  return result;
}
