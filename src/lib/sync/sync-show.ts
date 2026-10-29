import { db } from '@/lib/db';
import { notifyUsers, type NotificationPayload } from '@/lib/notifications/notify';
import { batchFetchAnilistData, parseAnilistProviders, parseAnilistProviderLinks, buildAnilistEpisodes, stripHtml, mapAnilistStatus } from '@/lib/anilist/client';
import { TMDB_BASE, tmdbHeaders, mapTmdbStatus, fetchTmdbProviders } from '@/lib/tmdb/client';
import { ANILIST_RELATION_MAP, inverseRelationType } from '@/lib/shows/relations';
import type { Show, ShowStatus } from '@prisma/client';


async function syncRelations(
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

const DAY = 86_400_000;

export function nextSyncMs(status: ShowStatus): number {
  switch (status) {
    case 'RETURNING':     return 1  * DAY;
    case 'UPCOMING':      return 7  * DAY;
    case 'IN_PRODUCTION': return 30 * DAY;
    case 'ENDED':
    case 'CANCELED':      return 90 * DAY;
    default:              return 30 * DAY;
  }
}

// ── Notifications de changement ───────────────────────────────────────────────

async function notifyChanges(
  showId: string,
  showTitle: string,
  prevStatus: ShowStatus,
  newStatus: ShowStatus,
  prevTotalSeasons: number,
  newTotalSeasons: number,
): Promise<void> {
  const subscribers = await db.userShow.findMany({
    where: { showId, notifyEnabled: true },
    select: { userId: true },
  });
  if (!subscribers.length) return;

  const notifs: NotificationPayload[] = [];

  if (newTotalSeasons > prevTotalSeasons) {
    const diff = newTotalSeasons - prevTotalSeasons;
    for (const { userId } of subscribers) {
      notifs.push({
        userId,
        type: 'NEW_SEASON',
        title: showTitle,
        body: diff > 1
          ? `${diff} nouvelles saisons disponibles (jusqu'à S${newTotalSeasons})`
          : `Saison ${newTotalSeasons} disponible`,
        showId,
      });
    }
  }

  const wasInactive = prevStatus === 'ENDED' || prevStatus === 'CANCELED' || prevStatus === 'IN_PRODUCTION';
  if (prevStatus !== newStatus && newStatus === 'RETURNING' && wasInactive) {
    for (const { userId } of subscribers) {
      notifs.push({
        userId,
        type: 'SHOW_RETURNING',
        title: showTitle,
        body: 'La série reprend !',
        showId,
      });
    }
  }

  await notifyUsers(notifs);
}

// ── TMDB ──────────────────────────────────────────────────────────────────────

async function syncFromTmdb(
  showId: string,
  tmdbId: number,
  prevTotalSeasons: number,
): Promise<{ newStatus: ShowStatus; newTotalSeasons: number }> {
  if (!process.env.TMDB_READ_ACCESS_TOKEN) throw new Error('TMDB_READ_ACCESS_TOKEN manquant');

  const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}?language=fr-FR`, { headers: tmdbHeaders() });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();

  const newStatus = mapTmdbStatus(data.status);
  const newTotalSeasons: number = data.number_of_seasons ?? 0;

  // Keeps the current providers when TMDB has no French data
  const providerUpdate = (await fetchTmdbProviders(tmdbId)) ?? {};

  await db.show.update({
    where: { id: showId },
    data: {
      title: data.name,
      status: newStatus,
      overview: data.overview,
      posterPath: data.poster_path ?? null,
      backdropPath: data.backdrop_path ?? null,
      totalSeasons: newTotalSeasons,
      ...providerUpdate,
    },
  });

  // Sync uniquement les saisons nouvelles + la saison en cours (épisodes récents)
  const allSeasons: Array<{ season_number: number; name: string; air_date: string; poster_path: string }> =
    (data.seasons ?? []).filter((s: { season_number: number }) => s.season_number > 0);

  const seasonsToSync = allSeasons.filter(s =>
    s.season_number > prevTotalSeasons || s.season_number === newTotalSeasons,
  );

  for (const s of seasonsToSync) {
    const season = await db.season.upsert({
      where: { showId_number: { showId, number: s.season_number } },
      update: { title: s.name, year: s.air_date ? new Date(s.air_date).getFullYear() : null },
      create: {
        showId,
        number: s.season_number,
        title: s.name,
        year: s.air_date ? new Date(s.air_date).getFullYear() : null,
        posterPath: s.poster_path ?? null,
      },
    });

    const sRes = await fetch(
      `${TMDB_BASE}/tv/${tmdbId}/season/${s.season_number}?language=fr-FR`,
      { headers: tmdbHeaders() },
    );
    if (!sRes.ok) continue;
    const sData = await sRes.json();

    for (const ep of sData.episodes ?? []) {
      await db.episode.upsert({
        where: { seasonId_number: { seasonId: season.id, number: ep.episode_number } },
        update: {
          title: ep.name,
          overview: ep.overview ?? null,
          runtime: ep.runtime ?? null,
          airDate: ep.air_date ? new Date(ep.air_date) : null,
        },
        create: {
          seasonId: season.id,
          number: ep.episode_number,
          title: ep.name,
          overview: ep.overview ?? null,
          runtime: ep.runtime ?? null,
          airDate: ep.air_date ? new Date(ep.air_date) : null,
          stillPath: ep.still_path ?? null,
        },
      });
    }
  }

  return { newStatus, newTotalSeasons };
}

// ── AniList ───────────────────────────────────────────────────────────────────

interface AnilistPayload {
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

type SequelInfo = { anilistId: number; status: string; title: string };

async function checkAndNotifySequels(
  showId: string,
  showTitle: string,
  parentAnilistId: number | null,
  relations: AnilistPayload['relations'],
): Promise<void> {
  const sequels: SequelInfo[] = (relations?.edges ?? [])
    .filter(e => e.relationType === 'SEQUEL' && e.node.type === 'ANIME')
    .filter(e => e.node.status === 'RELEASING' || e.node.status === 'NOT_YET_RELEASED')
    .map(e => ({
      anilistId: e.node.id,
      status: e.node.status,
      title: e.node.title.english ?? e.node.title.romaji ?? 'Suite',
    }));

  if (!sequels.length) return;

  const subscribers = await db.userShow.findMany({
    where: { showId, notifyEnabled: true },
    select: { userId: true },
  });
  if (!subscribers.length) return;

  // Map anilistId → dbId pour les suites déjà en base
  const inDb = await db.show.findMany({
    where: { anilistId: { in: sequels.map(s => s.anilistId) } },
    select: { id: true, anilistId: true },
  });
  const inDbMap = new Map(inDb.map(s => [s.anilistId, s.id]));

  let notifSent = false;

  for (const sequel of sequels) {
    let sequelDbId = inDbMap.get(sequel.anilistId) ?? null;

    // Suite pas encore en base → on l'importe
    if (!sequelDbId) {
      try {
        // Import dynamique pour éviter la dépendance circulaire (import-show → sync-show)
        const { importShowFromAnilist } = await import('@/lib/sync/import-show');
        const visited = new Set(parentAnilistId ? [parentAnilistId] : [] as number[]);
        const imported = await importShowFromAnilist(sequel.anilistId, visited);
        sequelDbId = imported.id;

        // Notif push — une seule fois par show par 30 jours
        if (!notifSent) {
          const since = new Date(Date.now() - 30 * DAY);
          const already = await db.notification.findFirst({
            where: { showId, type: 'SHOW_RETURNING', createdAt: { gte: since } },
          });
          if (!already) {
            const body = sequel.status === 'RELEASING'
              ? `Suite en cours de diffusion : ${sequel.title}`
              : `Suite annoncée : ${sequel.title}`;
            await notifyUsers(subscribers.map(({ userId }) => ({
              userId, type: 'SHOW_RETURNING' as const, title: showTitle, body, showId,
            })));
            notifSent = true;
          }
        }
      } catch {
        continue;
      }
    }

    if (!sequelDbId) continue;

    // Ajoute la suite en À regarder pour chaque abonné qui ne l'a pas encore
    for (const { userId } of subscribers) {
      await db.userShow.upsert({
        where: { userId_showId: { userId, showId: sequelDbId } },
        update: {},
        create: { userId, showId: sequelDbId, status: 'PLAN_TO_WATCH' },
      });
    }
  }
}

async function applyAnilistData(showId: string, payload: AnilistPayload): Promise<ShowStatus> {
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

async function syncFromAnilist(showId: string, anilistId: number): Promise<{ newStatus: ShowStatus }> {
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

// ── API publique ──────────────────────────────────────────────────────────────

export async function syncShow(showId: string): Promise<void> {
  const show = await db.show.findUniqueOrThrow({
    where: { id: showId },
    select: { id: true, title: true, tmdbId: true, anilistId: true, status: true, totalSeasons: true },
  });

  const prevStatus = show.status;
  const prevTotalSeasons = show.totalSeasons;
  let newStatus: ShowStatus = prevStatus;
  let newTotalSeasons = prevTotalSeasons;

  if (show.tmdbId) {
    ({ newStatus, newTotalSeasons } = await syncFromTmdb(show.id, show.tmdbId, prevTotalSeasons));
  } else if (show.anilistId) {
    ({ newStatus } = await syncFromAnilist(show.id, show.anilistId));
  }

  await db.show.update({
    where: { id: showId },
    data: {
      lastSyncedAt: new Date(),
      nextSyncAt: new Date(Date.now() + nextSyncMs(newStatus)),
    },
  });

  await notifyChanges(show.id, show.title, prevStatus, newStatus, prevTotalSeasons, newTotalSeasons);
}

type ShowForBatch = Pick<Show, 'id' | 'title' | 'anilistId' | 'status' | 'totalSeasons'>;

export async function batchSyncAnilistShows(
  shows: ShowForBatch[],
): Promise<{ synced: number; errors: number }> {
  if (!shows.length) return { synced: 0, errors: 0 };

  const ids = shows.map(s => s.anilistId!);
  const dataMap = await batchFetchAnilistData(ids);

  let synced = 0;
  let errors = 0;

  for (const show of shows) {
    const payload = dataMap.get(show.anilistId!);
    if (!payload) { errors++; continue; }

    try {
      const newStatus = await applyAnilistData(show.id, payload);

      await db.show.update({
        where: { id: show.id },
        data: {
          lastSyncedAt: new Date(),
          nextSyncAt: new Date(Date.now() + nextSyncMs(newStatus)),
        },
      });

      await notifyChanges(show.id, show.title, show.status, newStatus, show.totalSeasons, show.totalSeasons);
      await checkAndNotifySequels(show.id, show.title, show.anilistId, payload.relations);
      await syncRelations(show.id, payload.relations);
      synced++;
    } catch {
      errors++;
    }
  }

  return { synced, errors };
}
