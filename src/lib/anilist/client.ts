import type { ShowStatus } from '@prisma/client';

const ENDPOINT = 'https://graphql.anilist.co';

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
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
  episodes: AnilistEpisode[];
  relations: AnilistRelation[];
}

export interface AnilistEpisode {
  number: number;
  airDate: Date | null;
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

  const episodes: AnilistEpisode[] = (airingSchedule?.nodes ?? []).map(n => ({
    number: n.episode,
    airDate: new Date(n.airingAt * 1000),
  }));

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

  return {
    anilistId,
    title: title.english ?? title.romaji,
    originalTitle: title.romaji ?? null,
    type: 'ANIME',
    year: startDate?.year ?? null,
    posterPath: coverImage?.extraLarge ?? null,
    backdropPath: m.bannerImage as string ?? null,
    overview: (m.description as string)?.replace(/<[^>]+>/g, '') ?? null,
    status: mapStatus(m.status as string),
    network: (m.studios as { nodes: { name: string }[] })?.nodes?.[0]?.name ?? null,
    genre: (m.genres as string[] ?? []).slice(0, 3).join(' · ') || null,
    runtime: m.duration as number ?? null,
    totalSeasons: 1,
    episodes,
    relations,
  };
}

function mapStatus(s: string): ShowStatus {
  const m: Record<string, ShowStatus> = {
    FINISHED: 'ENDED',
    RELEASING: 'RETURNING',
    NOT_YET_RELEASED: 'UPCOMING',
    CANCELLED: 'CANCELED',
  };
  return m[s] ?? 'RETURNING';
}
