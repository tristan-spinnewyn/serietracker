import { db } from '@/lib/db';
import { batchFetchAnilistData, parseAnilistProviders, parseAnilistProviderLinks, buildAnilistEpisodes, stripHtml, mapAnilistStatus } from '@/lib/anilist/client';
import { ANILIST_RELATION_MAP, inverseRelationType } from '@/lib/shows/relations';
import { checkAndNotifySequels } from '@/lib/sync/show-notifications';
import type { ShowStatus } from '@prisma/client';

export interface AnilistPayload {
  status: string;
  title: { english?: string; romaji?: string };
  coverImage?: { extraLarge?: string };
  bannerImage?: string;
  description?: string;
  episodes?: number | null;
  airingSchedule?: { nodes: Array<{ episode: number; airingAt: number }> };
  externalLinks?: Array<{ site: string; type: string; url?: string }>;
  relations?: {
    edges: Array<{
      relationType: string;
      node: { id: number; type: string; status: string; title: { english?: string; romaji?: string } };
    }>;
  };
}

export async function syncRelations(
  showId: string,
  relations: AnilistPayload['relations'],
): Promise<void> {
  const KEPT = new Set(['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'ALTERNATIVE', 'PARENT']);
  const edges = (relations?.edges ?? [])
    .filter(e => KEPT.has(e.relationType) && e.node.type === 'ANIME');

  for (const edge of edges) {
    const relShow = await db.show.findUnique({
      where: { anilistId: edge.node.id },
      select: { id: true },
    });
    if (!relShow) continue; // pas encore importé → skip

    const relType = ANILIST_RELATION_MAP[edge.relationType] ?? 'RELATED';

    await db.showRelation.upsert({
      where: { fromShowId_toShowId: { fromShowId: showId, toShowId: relShow.id } },
      update: {},
      create: { fromShowId: showId, toShowId: relShow.id, type: relType },
    });
    await db.showRelation.upsert({
      where: { fromShowId_toShowId: { fromShowId: relShow.id, toShowId: showId } },
      update: {},
      create: { fromShowId: relShow.id, toShowId: showId, type: inverseRelationType(relType) },
    });
  }
}

export async function applyAnilistData(showId: string, payload: AnilistPayload): Promise<ShowStatus> {
  const newStatus = mapAnilistStatus(payload.status);
  const links = payload.externalLinks ?? [];
  const providers = links.length ? parseAnilistProviders(links) : undefined;
  const providerLinks = links.length ? parseAnilistProviderLinks(links) : undefined;

  await db.show.update({
    where: { id: showId },
    data: {
      title: payload.title.english ?? payload.title.romaji ?? undefined,
      status: newStatus,
      overview: stripHtml(payload.description),
      posterPath: payload.coverImage?.extraLarge ?? null,
      backdropPath: payload.bannerImage ?? null,
      ...(providers !== undefined ? { providers } : {}),
      ...(providerLinks !== undefined ? { providerLinks } : {}),
    },
  });

  const episodes = buildAnilistEpisodes(payload.airingSchedule?.nodes, payload.episodes);
  if (episodes.length > 0) {
    const season = await db.season.upsert({
      where: { showId_number: { showId, number: 1 } },
      update: {},
      create: { showId, number: 1, title: 'Saison 1' },
    });
    for (const ep of episodes) {
      await db.episode.upsert({
        where: { seasonId_number: { seasonId: season.id, number: ep.number } },
        update: ep.airDate ? { airDate: ep.airDate } : {},
        create: { seasonId: season.id, number: ep.number, airDate: ep.airDate },
      });
    }
  }

  return newStatus;
}

export async function syncFromAnilist(showId: string, anilistId: number): Promise<{ newStatus: ShowStatus }> {
  // Passe par batchFetchAnilistData (helper gql() partagé) → rate-limit, retry 429/403, UA
  // throwOnApiFailure → AnilistApiError clair si Cloudflare nous bloque, au lieu d'un faux "introuvable"
  const batch = await batchFetchAnilistData([anilistId], { throwOnApiFailure: true });
  const media = batch.get(anilistId);
  if (!media) throw new Error(`AniList ${anilistId} introuvable`);

  const payload = media as AnilistPayload;
  const newStatus = await applyAnilistData(showId, payload);

  const show = await db.show.findUnique({ where: { id: showId }, select: { title: true } });
  if (show) await checkAndNotifySequels(showId, show.title, anilistId, payload.relations);
  await syncRelations(showId, payload.relations);

  return { newStatus };
}
