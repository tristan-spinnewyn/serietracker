'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { importShowFromAnilist } from '@/lib/sync/import-show';
import { fetchAnilistUserList } from '@/lib/anilist/client';
import type { WatchStatus } from '@prisma/client';

const STATUS_MAP: Record<string, WatchStatus> = {
  CURRENT:   'WATCHING',
  COMPLETED: 'COMPLETED',
  PLANNING:  'PLAN_TO_WATCH',
  DROPPED:   'DROPPED',
  PAUSED:    'PAUSED',
  REPEATING: 'WATCHING',
};

export type SyncResult =
  | { status: 'ok'; imported: number; skipped: number; errors: number }
  | { status: 'not_found' }
  | { status: 'error' };

export async function syncFromAnilist(username: string): Promise<SyncResult> {
  const session = await auth();
  if (!session?.user) return { status: 'error' };
  const userId = session.user.id;

  const entries = await fetchAnilistUserList(username.trim());
  if (entries === null) return { status: 'not_found' };

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const show = await importShowFromAnilist(entry.anilistId);
      const watchStatus = STATUS_MAP[entry.status] ?? 'PLAN_TO_WATCH';

      const existing = await db.userShow.findUnique({
        where: { userId_showId: { userId, showId: show.id } },
        select: { status: true },
      });

      if (existing) {
        // Ne pas écraser un statut plus avancé (ex: COMPLETED → WATCHING)
        const PRIORITY: Record<string, number> = {
          PLAN_TO_WATCH: 0, WATCHING: 1, PAUSED: 2, DROPPED: 3, COMPLETED: 4,
        };
        const currentPriority = PRIORITY[existing.status] ?? 0;
        const newPriority = PRIORITY[watchStatus] ?? 0;

        if (newPriority > currentPriority) {
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

  revalidatePath('/dashboard');
  revalidatePath('/settings');
  return { status: 'ok', imported, skipped, errors };
}
