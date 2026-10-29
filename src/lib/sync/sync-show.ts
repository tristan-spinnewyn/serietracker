import { db } from '@/lib/db';
import { batchFetchAnilistData } from '@/lib/anilist/client';
import { nextSyncMs } from '@/lib/sync/sync-schedule';
import { syncFromTmdb } from '@/lib/sync/tmdb-show-sync';
import { applyAnilistData, syncFromAnilist, syncRelations } from '@/lib/sync/anilist-show-sync';
import { notifyChanges, checkAndNotifySequels } from '@/lib/sync/show-notifications';
import type { Show, ShowStatus } from '@prisma/client';

// Kept here so existing imports of nextSyncMs keep working
export { nextSyncMs };

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
