'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { db } from '@/lib/db';
import { idListSchema } from '@/lib/validation';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { completeFinishedShows, notifyCompletedSeasons } from '@/lib/services/watch-progress';
import type { WatchStatus } from '@prisma/client';

// Season notifications, then auto-completion of finished shows
async function updateWatchProgress(userId: string, episodeIds: string[]) {
  await notifyCompletedSeasons(userId, episodeIds);
  const completedShowIds = await completeFinishedShows(userId, episodeIds);
  for (const showId of completedShowIds) {
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
    // Auto-ajoute le show en WATCHING s'il n'est pas encore dans la liste
    const episode = await db.episode.findUnique({
      where: { id: episodeId },
      select: { season: { select: { showId: true } } },
    });
    if (episode) {
      await db.userShow.upsert({
        where: { userId_showId: { userId: session.user.id, showId: episode.season.showId } },
        update: {},
        create: { userId: session.user.id, showId: episode.season.showId, status: 'WATCHING' },
      });
    }

    await db.userEpisode.upsert({
      where: { userId_episodeId: { userId: session.user.id, episodeId } },
      update: {},
      create: { userId: session.user.id, episodeId },
    });
    await updateWatchProgress(session.user.id, [episodeId]);
  } else {
    await db.userEpisode.delete({
      where: { userId_episodeId: { userId: session.user.id, episodeId } },
    }).catch(() => null);
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

  await db.$transaction(
    episodeIds.map(episodeId =>
      db.userEpisode.upsert({
        where: { userId_episodeId: { userId: session.user.id, episodeId } },
        update: {},
        create: { userId: session.user.id, episodeId },
      }),
    ),
  );

  await updateWatchProgress(session.user.id, episodeIds);
  revalidatePath('/show/[id]', 'page');
}

// ── Marquer tous les épisodes des shows terminés comme vus ──────────────────

export async function markAllCompletedEpisodesWatched(): Promise<{ count: number }> {
  const session = await requireSession();
  const userId = session.user.id;

  const completedShowIds = (
    await db.userShow.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { showId: true },
    })
  ).map(us => us.showId);

  if (!completedShowIds.length) return { count: 0 };

  const episodes = await db.episode.findMany({
    where: { season: { showId: { in: completedShowIds } } },
    select: { id: true },
  });

  const result = await db.userEpisode.createMany({
    data: episodes.map(ep => ({ userId, episodeId: ep.id })),
    skipDuplicates: true,
  });

  revalidatePath('/termine');
  revalidatePath('/dashboard');
  return { count: result.count };
}

// ── Tout marquer comme vu et passer en Terminé ──────────────────────────────

export async function markShowAllWatched(showId: string) {
  const session = await requireSession();
  const userId = session.user.id;

  await db.userShow.upsert({
    where: { userId_showId: { userId, showId } },
    update: {},
    create: { userId, showId, status: 'WATCHING' },
  });

  const now = new Date();
  const airedEpisodes = await db.episode.findMany({
    where: {
      season: { showId },
      OR: [{ airDate: null }, { airDate: { lte: now } }],
    },
    select: { id: true },
  });

  if (!airedEpisodes.length) return;

  await db.userEpisode.createMany({
    data: airedEpisodes.map(ep => ({ userId, episodeId: ep.id })),
    skipDuplicates: true,
  });

  const totalEpisodes = await db.episode.count({
    where: { season: { showId } },
  });
  const allAired = airedEpisodes.length === totalEpisodes;

  await db.userShow.update({
    where: { userId_showId: { userId, showId } },
    data: { status: allAired ? 'COMPLETED' : 'WATCHING' },
  });

  await notifyCompletedSeasons(userId, airedEpisodes.map(e => e.id));

  revalidatePath(`/show/${showId}`);
  revalidatePath('/dashboard');
}

// ── Tout marquer comme non vu ───────────────────────────────────────────────

export async function unmarkShowAllWatched(showId: string) {
  const session = await requireSession();
  const userId = session.user.id;

  const episodes = await db.episode.findMany({
    where: { season: { showId } },
    select: { id: true },
  });

  if (episodes.length > 0) {
    await db.userEpisode.deleteMany({
      where: {
        userId,
        episodeId: { in: episodes.map(e => e.id) },
      },
    });
  }

  const userShow = await db.userShow.findUnique({
    where: { userId_showId: { userId, showId } },
    select: { status: true },
  });

  if (userShow && (userShow.status === 'COMPLETED' || userShow.status === 'WATCHING')) {
    await db.userShow.update({
      where: { userId_showId: { userId, showId } },
      data: { status: 'PLAN_TO_WATCH' },
    });
  }

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
