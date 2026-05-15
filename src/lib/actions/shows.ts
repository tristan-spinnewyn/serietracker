'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import type { WatchStatus } from '@prisma/client';

// Auto-passe le show en COMPLETED quand tous les épisodes sont vus (show terminé/annulé)
async function checkShowComplete(userId: string, episodeIds: string[]) {
  const eps = await db.episode.findMany({
    where: { id: { in: episodeIds } },
    select: { season: { select: { showId: true } } },
  });
  const showIds = [...new Set(eps.map(e => e.season.showId))];

  for (const showId of showIds) {
    const [show, userShow] = await Promise.all([
      db.show.findUnique({ where: { id: showId }, select: { status: true } }),
      db.userShow.findUnique({
        where: { userId_showId: { userId, showId } },
        select: { status: true },
      }),
    ]);

    // Seulement si le show a fini de diffuser et que l'user le regardait / l'avait mis en pause
    if (!show || !['ENDED', 'CANCELED'].includes(show.status)) continue;
    if (!userShow || !['WATCHING', 'PAUSED'].includes(userShow.status)) continue;

    const [totalEps, watchedEps] = await Promise.all([
      db.episode.count({ where: { season: { showId } } }),
      db.userEpisode.count({ where: { userId, episode: { season: { showId } } } }),
    ]);

    if (totalEps > 0 && watchedEps >= totalEps) {
      await db.userShow.update({
        where: { userId_showId: { userId, showId } },
        data: { status: 'COMPLETED' },
      });
      revalidatePath('/dashboard');
      revalidatePath(`/show/${showId}`);
    }
  }
}

async function checkSeasonComplete(userId: string, episodeIds: string[]) {
  if (!episodeIds.length) return;

  const episodes = await db.episode.findMany({
    where: { id: { in: episodeIds } },
    select: {
      seasonId: true,
      season: {
        select: {
          id: true, number: true,
          showId: true,
          show: { select: { title: true } },
          episodes: { select: { id: true } },
        },
      },
    },
  });

  const seasons = new Map(episodes.map(e => [e.seasonId, e.season]));

  for (const season of seasons.values()) {
    const allIds = season.episodes.map(e => e.id);
    const watchedCount = await db.userEpisode.count({
      where: { userId, episodeId: { in: allIds } },
    });
    if (watchedCount < allIds.length) continue;

    const since = new Date(Date.now() - 7 * 86_400_000);
    const already = await db.notification.findFirst({
      where: { userId, showId: season.showId, type: 'SEASON_COMPLETE', createdAt: { gte: since } },
    });
    if (already) continue;

    await db.notification.create({
      data: {
        userId,
        type: 'SEASON_COMPLETE',
        title: season.show.title,
        body: `Tu as terminé la saison ${season.number} !`,
        showId: season.showId,
      },
    });
  }
}

async function getSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Non authentifié');
  return session;
}

// ── Ajouter / modifier le statut d'un show ──────────────────────────────────

const upsertSchema = z.object({
  showId: z.string(),
  status: z.enum(['WATCHING', 'COMPLETED', 'PLAN_TO_WATCH', 'DROPPED', 'PAUSED']),
});

export async function upsertUserShow(data: { showId: string; status: WatchStatus }) {
  const session = await getSession();
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
  const session = await getSession();

  await db.userShow.delete({
    where: { userId_showId: { userId: session.user.id, showId } },
  }).catch(() => null); // ignore si absent

  revalidatePath('/dashboard');
  revalidatePath(`/show/${showId}`);
}

// ── Marquer / démarquer un épisode ───────────────────────────────────────────

export async function toggleEpisode(episodeId: string, watched: boolean) {
  const session = await getSession();

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
    await checkSeasonComplete(session.user.id, [episodeId]);
    await checkShowComplete(session.user.id, [episodeId]);
  } else {
    await db.userEpisode.delete({
      where: { userId_episodeId: { userId: session.user.id, episodeId } },
    }).catch(() => null);
  }

  revalidatePath('/show/[id]', 'page');
}

// ── Réimporter manuellement un show ─────────────────────────────────────────

export async function resyncShow(showId: string) {
  await getSession();
  const { syncShow } = await import('@/lib/sync/sync-show');
  await syncShow(showId);
  revalidatePath(`/show/${showId}`);
}

// ── Marquer plusieurs épisodes comme vus ─────────────────────────────────────

export async function markEpisodesWatchedBatch(episodeIds: string[]) {
  const session = await getSession();
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

  await checkSeasonComplete(session.user.id, episodeIds);
  await checkShowComplete(session.user.id, episodeIds);
  revalidatePath('/show/[id]', 'page');
}

// ── Marquer tous les épisodes des shows terminés comme vus ──────────────────

export async function markAllCompletedEpisodesWatched(): Promise<{ count: number }> {
  const session = await getSession();
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
  const session = await getSession();
  const userId = session.user.id;

  await db.userShow.upsert({
    where: { userId_showId: { userId, showId } },
    update: {},
    create: { userId, showId, status: 'WATCHING' },
  });

  const episodes = await db.episode.findMany({
    where: { season: { showId } },
    select: { id: true },
  });

  if (!episodes.length) return;

  await db.userEpisode.createMany({
    data: episodes.map(ep => ({ userId, episodeId: ep.id })),
    skipDuplicates: true,
  });

  await db.userShow.update({
    where: { userId_showId: { userId, showId } },
    data: { status: 'COMPLETED' },
  });

  await checkSeasonComplete(userId, episodes.map(e => e.id));

  revalidatePath(`/show/${showId}`);
  revalidatePath('/dashboard');
}

// ── Toggle notification pour un show ────────────────────────────────────────

export async function toggleShowNotif(showId: string, enabled: boolean) {
  const session = await getSession();

  await db.userShow.update({
    where: { userId_showId: { userId: session.user.id, showId } },
    data: { notifyEnabled: enabled },
  });

  revalidatePath(`/show/${showId}`);
}

// ── Noter un show ────────────────────────────────────────────────────────────

export async function rateShow(showId: string, rating: number) {
  const session = await getSession();

  const r = Math.min(5, Math.max(0, Math.round(rating * 2) / 2));

  await db.userShow.update({
    where: { userId_showId: { userId: session.user.id, showId } },
    data: { rating: r },
  });

  revalidatePath(`/show/${showId}`);
}
