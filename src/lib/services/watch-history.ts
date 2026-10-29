import { db } from '@/lib/db';
import { completeFinishedShows, notifyCompletedSeasons } from '@/lib/services/watch-progress';

// Season notifications, then auto-completion of finished shows. Returns the
// ids of the shows that moved to COMPLETED.
async function afterEpisodesWatched(userId: string, episodeIds: string[]): Promise<string[]> {
  await notifyCompletedSeasons(userId, episodeIds);
  return completeFinishedShows(userId, episodeIds);
}

/**
 * Marks one episode as watched, adding its show to the user's list as
 * WATCHING when it is not there yet. Returns the shows that became COMPLETED.
 */
export async function markEpisodeWatched(userId: string, episodeId: string): Promise<string[]> {
  const episode = await db.episode.findUnique({
    where: { id: episodeId },
    select: { season: { select: { showId: true } } },
  });
  if (episode) {
    await db.userShow.upsert({
      where: { userId_showId: { userId, showId: episode.season.showId } },
      update: {},
      create: { userId, showId: episode.season.showId, status: 'WATCHING' },
    });
  }

  await db.userEpisode.upsert({
    where: { userId_episodeId: { userId, episodeId } },
    update: {},
    create: { userId, episodeId },
  });
  return afterEpisodesWatched(userId, [episodeId]);
}

export async function unmarkEpisodeWatched(userId: string, episodeId: string): Promise<void> {
  await db.userEpisode.delete({
    where: { userId_episodeId: { userId, episodeId } },
  }).catch(() => null); // already unwatched
}

/** Marks several episodes as watched. Returns the shows that became COMPLETED. */
export async function markEpisodesWatched(userId: string, episodeIds: string[]): Promise<string[]> {
  await db.$transaction(
    episodeIds.map(episodeId =>
      db.userEpisode.upsert({
        where: { userId_episodeId: { userId, episodeId } },
        update: {},
        create: { userId, episodeId },
      }),
    ),
  );
  return afterEpisodesWatched(userId, episodeIds);
}

/** Marks every episode of the user's COMPLETED shows as watched. Returns how many were added. */
export async function markCompletedShowsWatched(userId: string): Promise<number> {
  const completedShowIds = (
    await db.userShow.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { showId: true },
    })
  ).map(us => us.showId);

  if (!completedShowIds.length) return 0;

  const episodes = await db.episode.findMany({
    where: { season: { showId: { in: completedShowIds } } },
    select: { id: true },
  });

  const result = await db.userEpisode.createMany({
    data: episodes.map(ep => ({ userId, episodeId: ep.id })),
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * Marks every aired episode of a show as watched, adding the show if needed.
 * The show ends up COMPLETED when nothing is left to air, WATCHING otherwise.
 * Returns false when the show has no aired episode.
 */
export async function markShowWatched(userId: string, showId: string): Promise<boolean> {
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

  if (!airedEpisodes.length) return false;

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
  return true;
}

/** Clears every watched episode of a show and moves it back to PLAN_TO_WATCH if it was in progress or done. */
export async function unmarkShowWatched(userId: string, showId: string): Promise<void> {
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
}
