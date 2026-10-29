import type { WatchStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { importShowFromAnilist } from '@/lib/sync/import-show';
import type { AnilistListEntry } from '@/lib/anilist/client';

const STATUS_MAP: Record<string, WatchStatus> = {
  CURRENT:   'WATCHING',
  COMPLETED: 'COMPLETED',
  PLANNING:  'PLAN_TO_WATCH',
  DROPPED:   'DROPPED',
  PAUSED:    'PAUSED',
  REPEATING: 'WATCHING',
};

// How far along a status is, so an import never moves a show backwards
const STATUS_PRIORITY: Record<WatchStatus, number> = {
  PLAN_TO_WATCH: 0, WATCHING: 1, PAUSED: 2, DROPPED: 3, COMPLETED: 4,
};

/**
 * Adds an AniList library to the user's shows: imports each anime, sets its
 * status (only moving it forward for shows already in the list) and the
 * AniList score for new ones.
 */
export async function importAnilistLibrary(userId: string, entries: AnilistListEntry[]) {
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const show = await importShowFromAnilist(entry.anilistId, new Set(), true);
      const watchStatus = STATUS_MAP[entry.status] ?? 'PLAN_TO_WATCH';

      const existing = await db.userShow.findUnique({
        where: { userId_showId: { userId, showId: show.id } },
        select: { status: true },
      });

      if (existing) {
        // Never downgrade a more advanced status (e.g. COMPLETED → WATCHING)
        if (STATUS_PRIORITY[watchStatus] > STATUS_PRIORITY[existing.status]) {
          await db.userShow.update({
            where: { userId_showId: { userId, showId: show.id } },
            data: { status: watchStatus },
          });
        }
        skipped++;
      } else {
        await db.userShow.create({
          data: { userId, showId: show.id, status: watchStatus },
        });

        // Note sur le rating AniList (0-100 → 0-5)
        if (entry.score > 0) {
          await db.userShow.update({
            where: { userId_showId: { userId, showId: show.id } },
            data: { rating: Math.round((entry.score / 20) * 2) / 2 },
          });
        }

        imported++;
      }
    } catch {
      errors++;
    }
  }

  return { imported, skipped, errors };
}
