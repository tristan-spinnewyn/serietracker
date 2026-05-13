'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import type { WatchStatus } from '@prisma/client';

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
    await db.userEpisode.upsert({
      where: { userId_episodeId: { userId: session.user.id, episodeId } },
      update: {},
      create: { userId: session.user.id, episodeId },
    });
  } else {
    await db.userEpisode.delete({
      where: { userId_episodeId: { userId: session.user.id, episodeId } },
    }).catch(() => null);
  }

  // Revalider la page du show (showId inconnu ici → revalider toutes les shows)
  revalidatePath('/show/[id]', 'page');
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

  revalidatePath('/show/[id]', 'page');
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
