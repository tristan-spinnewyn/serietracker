import { db } from '@/lib/db';
import { sendPushToUser } from '@/lib/notifications/push';
import { batchFetchAnilistData, parseAnilistProviders, parseAnilistProviderLinks } from '@/lib/anilist/client';
import type { Show, ShowStatus, NotifType } from '@prisma/client';

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

type NotifPayload = {
  userId: string;
  type: NotifType;
  title: string;
  body: string;
  showId: string;
};

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

  const notifs: NotifPayload[] = [];

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

  if (!notifs.length) return;

  await db.notification.createMany({ data: notifs });

  const userIds = [...new Set(notifs.map(n => n.userId))];
  await Promise.allSettled(
    userIds.map(userId => {
      const n = notifs.find(n => n.userId === userId)!;
      return sendPushToUser(userId, { title: n.title, body: n.body });
    }),
  );
}

// ── TMDB ──────────────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://api.themoviedb.org/3';
const tmdbHeaders = () => ({ Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}` });

function mapTmdbStatus(s: string): ShowStatus {
  const m: Record<string, ShowStatus> = {
    'Returning Series': 'RETURNING',
    'Ended': 'ENDED',
    'Canceled': 'CANCELED',
    'In Production': 'IN_PRODUCTION',
    'Planned': 'UPCOMING',
  };
  return m[s] ?? 'RETURNING';
}

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

  // Fetch providers + lien JustWatch (appel séparé)
  const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
  const provRes = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}/watch/providers`, { headers: tmdbHeaders() }).catch(() => null);
  let providerUpdate: { providers?: string[]; providerLinks?: Record<string, string> } = {};
  if (provRes?.ok) {
    const provData = await provRes.json();
    const fr = provData.results?.FR;
    if (fr) {
      const TMDB_PROVIDER_MAP: Record<number, string> = {
        8: 'netflix', 119: 'prime', 337: 'disney', 350: 'appletv',
        63: 'canal', 283: 'crunchyroll', 1899: 'max', 493: 'arte', 2237: 'tf1', 430: 'hidive',
      };
      const all: { provider_id: number }[] = [...(fr.flatrate ?? []), ...(fr.free ?? [])];
      const providers = [...new Set(all.map(p => TMDB_PROVIDER_MAP[p.provider_id]).filter(Boolean) as string[])];
      const justWatchUrl: string | null = fr.link ?? null;
      const providerLinks: Record<string, string> = {};
      if (justWatchUrl) providers.forEach(k => { providerLinks[k] = justWatchUrl; });
      providerUpdate = { providers, providerLinks };
    }
  }

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

function mapAnilistStatus(s: string): ShowStatus {
  const m: Record<string, ShowStatus> = {
    FINISHED: 'ENDED',
    RELEASING: 'RETURNING',
    NOT_YET_RELEASED: 'UPCOMING',
    CANCELLED: 'CANCELED',
  };
  return m[s] ?? 'RETURNING';
}

interface AnilistPayload {
  status: string;
  title: { english?: string; romaji?: string };
  coverImage?: { extraLarge?: string };
  bannerImage?: string;
  description?: string;
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

  // Garder uniquement les séquelles pas encore importées dans la DB
  const existing = await db.show.findMany({
    where: { anilistId: { in: sequels.map(s => s.anilistId) } },
    select: { anilistId: true },
  });
  const existingIds = new Set(existing.map(s => s.anilistId));
  const unimported = sequels.filter(s => !existingIds.has(s.anilistId));
  if (!unimported.length) return;

  // Éviter les doublons : pas de notif SHOW_RETURNING pour ce show dans les 30 derniers jours
  const since = new Date(Date.now() - 30 * DAY);
  const already = await db.notification.findFirst({
    where: { showId, type: 'SHOW_RETURNING', createdAt: { gte: since } },
  });
  if (already) return;

  const subscribers = await db.userShow.findMany({
    where: { showId, notifyEnabled: true },
    select: { userId: true },
  });
  if (!subscribers.length) return;

  const sequel = unimported[0];
  const body = sequel.status === 'RELEASING'
    ? `Suite en cours de diffusion : ${sequel.title}`
    : `Suite annoncée : ${sequel.title}`;

  const notifs = subscribers.map(({ userId }) => ({
    userId,
    type: 'SHOW_RETURNING' as NotifType,
    title: showTitle,
    body,
    showId,
  }));

  await db.notification.createMany({ data: notifs });
  const userIds = [...new Set(notifs.map(n => n.userId))];
  await Promise.allSettled(
    userIds.map(userId => sendPushToUser(userId, { title: showTitle, body })),
  );
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
      overview: payload.description?.replace(/<[^>]+>/g, '') ?? null,
      posterPath: payload.coverImage?.extraLarge ?? null,
      backdropPath: payload.bannerImage ?? null,
      ...(providers !== undefined ? { providers } : {}),
      ...(providerLinks !== undefined ? { providerLinks } : {}),
    },
  });

  const episodes = payload.airingSchedule?.nodes ?? [];
  if (episodes.length > 0) {
    const season = await db.season.upsert({
      where: { showId_number: { showId, number: 1 } },
      update: {},
      create: { showId, number: 1, title: 'Saison 1' },
    });
    for (const ep of episodes) {
      await db.episode.upsert({
        where: { seasonId_number: { seasonId: season.id, number: ep.episode } },
        update: { airDate: new Date(ep.airingAt * 1000) },
        create: { seasonId: season.id, number: ep.episode, airDate: new Date(ep.airingAt * 1000) },
      });
    }
  }

  return newStatus;
}

async function syncFromAnilist(showId: string, anilistId: number): Promise<{ newStatus: ShowStatus }> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id status
        title { english romaji }
        coverImage { extraLarge }
        bannerImage
        description(asHtml: false)
        airingSchedule(notYetAired: false, perPage: 50) {
          nodes { episode airingAt }
        }
        externalLinks { site type }
        relations {
          edges {
            relationType
            node { id type status title { english romaji } }
          }
        }
      }
    }
  `;
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id: anilistId } }),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const { data } = await res.json();
  if (!data?.Media) throw new Error(`AniList ${anilistId} introuvable`);

  const payload = data.Media as AnilistPayload;
  const newStatus = await applyAnilistData(showId, payload);

  const show = await db.show.findUnique({ where: { id: showId }, select: { title: true } });
  if (show) await checkAndNotifySequels(showId, show.title, payload.relations);

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
      await checkAndNotifySequels(show.id, show.title, payload.relations);
      synced++;
    } catch {
      errors++;
    }
  }

  return { synced, errors };
}
