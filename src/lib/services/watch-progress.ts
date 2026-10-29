import { db } from '@/lib/db';

const SEASON_COMPLETE_DEDUP_MS = 7 * 86_400_000;

/**
 * Moves finished shows (ended or canceled) to COMPLETED for a user who has
 * now watched every episode. Returns the ids of the shows that changed.
 */
export async function completeFinishedShows(userId: string, episodeIds: string[]): Promise<string[]> {
  const eps = await db.episode.findMany({
    where: { id: { in: episodeIds } },
    select: { season: { select: { showId: true } } },
  });
  const showIds = [...new Set(eps.map(e => e.season.showId))];
  const completed: string[] = [];

  for (const showId of showIds) {
    const [show, userShow] = await Promise.all([
      db.show.findUnique({ where: { id: showId }, select: { status: true } }),
      db.userShow.findUnique({
        where: { userId_showId: { userId, showId } },
        select: { status: true },
      }),
    ]);

    // Only once the show has stopped airing, and only from an active watch status
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
      completed.push(showId);
    }
  }

  return completed;
}

/** Sends a SEASON_COMPLETE notification for every season the user just finished. */
export async function notifyCompletedSeasons(userId: string, episodeIds: string[]): Promise<void> {
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

    const since = new Date(Date.now() - SEASON_COMPLETE_DEDUP_MS);
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
