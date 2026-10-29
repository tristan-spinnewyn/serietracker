'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { db } from '@/lib/db';
import { idListSchema } from '@/lib/validation';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import {
  markEpisodeWatched, unmarkEpisodeWatched, markEpisodesWatched, markCompletedShowsWatched,
  markShowWatched, unmarkShowWatched,
} from '@/lib/services/watch-history';
import type { WatchStatus } from '@prisma/client';

// Pages showing a show that just moved to COMPLETED
function revalidateCompleted(showIds: string[]) {
  for (const showId of showIds) {
    revalidatePath('/dashboard');
    revalidatePath(`/show/${showId}`);
  }
}

// ── Ajouter / modifier le statut d'un show ──────────────────────────────────

const upsertSchema = z.object({
  showId: z.string(),
  status: z.enum(['WATCHING', 'COMPLETED', 'PLAN_TO_WATCH', 'DROPPED', 'PAUSED']),
});

export async function upsertUserShow(data: { showId: string; status: WatchStatus }) {
  const session = await requireSession();
  const { showId, status } = upsertSchema.parse(data);

  await db.userShow.upsert({
    where: { userId_showId: { userId: session.user.id, showId } },
    update: { status },
    create: { userId: session.user.id, showId, status },
  });

  revalidatePath('/dashboard');
  revalidatePath(`/show/${showId}`);
}

// ── Supprimer un show de sa liste ────────────────────────────────────────────

export async function removeUserShow(showId: string) {
  const session = await requireSession();

  await db.userShow.delete({
    where: { userId_showId: { userId: session.user.id, showId } },
  }).catch(() => null); // ignore si absent

  revalidatePath('/dashboard');
  revalidatePath(`/show/${showId}`);
}

// ── Marquer / démarquer un épisode ───────────────────────────────────────────

export async function toggleEpisode(episodeId: string, watched: boolean) {
  const session = await requireSession();

  if (watched) {
    revalidateCompleted(await markEpisodeWatched(session.user.id, episodeId));
  } else {
    await unmarkEpisodeWatched(session.user.id, episodeId);
  }

  revalidatePath('/show/[id]', 'page');
}

// ── Réimporter manuellement un show ─────────────────────────────────────────

export async function resyncShow(showId: string) {
  const session = await requireSession();
  if (!consumeRateLimit(`resync:${session.user.id}`, RATE_LIMITS.resyncPerUser).allowed) {
    throw new Error('Trop de synchronisations, réessaie dans une minute.');
  }
  const { syncShow } = await import('@/lib/sync/sync-show');
  await syncShow(showId);
  revalidatePath(`/show/${showId}`);
}

// ── Marquer plusieurs épisodes comme vus ─────────────────────────────────────

// Long-running anime can exceed a thousand episodes
const MAX_BATCH_EPISODES = 5000;

export async function markEpisodesWatchedBatch(rawEpisodeIds: string[]) {
  const session = await requireSession();
  const episodeIds = idListSchema(MAX_BATCH_EPISODES).parse(rawEpisodeIds);
  if (!episodeIds.length) return;

  revalidateCompleted(await markEpisodesWatched(session.user.id, episodeIds));
  revalidatePath('/show/[id]', 'page');
}

// ── Marquer tous les épisodes des shows terminés comme vus ──────────────────

export async function markAllCompletedEpisodesWatched(): Promise<{ count: number }> {
  const session = await requireSession();
  const count = await markCompletedShowsWatched(session.user.id);
  if (!count) return { count };

  revalidatePath('/termine');
  revalidatePath('/dashboard');
  return { count };
}

// ── Tout marquer comme vu et passer en Terminé ──────────────────────────────

export async function markShowAllWatched(showId: string) {
  const session = await requireSession();
  if (!(await markShowWatched(session.user.id, showId))) return;

  revalidatePath(`/show/${showId}`);
  revalidatePath('/dashboard');
}

// ── Tout marquer comme non vu ───────────────────────────────────────────────

export async function unmarkShowAllWatched(showId: string) {
  const session = await requireSession();
  await unmarkShowWatched(session.user.id, showId);

  revalidatePath(`/show/${showId}`);
  revalidatePath('/dashboard');
  revalidatePath('/termine');
}

// ── Toggle notification pour un show ────────────────────────────────────────

export async function toggleShowNotif(showId: string, enabled: boolean) {
  const session = await requireSession();

  await db.userShow.update({
    where: { userId_showId: { userId: session.user.id, showId } },
    data: { notifyEnabled: enabled },
  });

  revalidatePath(`/show/${showId}`);
}

// ── Noter un show ────────────────────────────────────────────────────────────

export async function rateShow(showId: string, rating: number) {
  const session = await requireSession();

  const r = Math.min(5, Math.max(0, Math.round(rating * 2) / 2));

  await db.userShow.update({
    where: { userId_showId: { userId: session.user.id, showId } },
    data: { rating: r },
  });

  revalidatePath(`/show/${showId}`);
}
