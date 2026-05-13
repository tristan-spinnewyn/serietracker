import { db } from '@/lib/db';
import { sendPushToUser } from '@/lib/notifications/push';
import { batchFetchAnilistData } from '@/lib/anilist/client';
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

  await db.show.update({
    where: { id: showId },
    data: {
      title: data.name,
      status: newStatus,
      overview: data.overview,
      posterPath: data.poster_path ?? null,
      backdropPath: data.backdrop_path ?? null,
      totalSeasons: newTotalSeasons,
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
}

async function applyAnilistData(showId: string, payload: AnilistPayload): Promise<ShowStatus> {
  const newStatus = mapAnilistStatus(payload.status);

  await db.show.update({
    where: { id: showId },
    data: {
      title: payload.title.english ?? payload.title.romaji ?? undefined,
      status: newStatus,
      overview: payload.description?.replace(/<[^>]+>/g, '') ?? null,
      posterPath: payload.coverImage?.extraLarge ?? null,
      backdropPath: payload.bannerImage ?? null,
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

  const newStatus = await applyAnilistData(showId, data.Media as AnilistPayload);
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
      synced++;
    } catch {
      errors++;
    }
  }

  return { synced, errors };
}
