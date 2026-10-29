import type { MediaType } from '@prisma/client';
import { db } from '@/lib/db';
import { countWatched, estimatedRuntime } from '@/lib/shows/progress';

const FINISHED = { in: ['ENDED', 'CANCELED'] as ('ENDED' | 'CANCELED')[] };
const DISCOVER_LIMIT = 12;

// Shows of a type that stopped airing and that the user follows or plans to watch
function followedFinished(userId: string, type: MediaType) {
  return db.userShow.findMany({
    where: {
      userId,
      status: { in: ['WATCHING', 'PAUSED', 'PLAN_TO_WATCH'] },
      show: { type, status: FINISHED },
    },
    include: {
      show: {
        include: { seasons: { include: { episodes: { select: { id: true } } } } },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

// Shows of a type that stopped airing and are not in the user's list yet
function discoverFinished(userId: string, type: MediaType) {
  return db.show.findMany({
    where: { type, status: FINISHED, userShows: { none: { userId } } },
    include: { seasons: { select: { _count: { select: { episodes: true } } } } },
    orderBy: { lastSyncedAt: 'desc' },
    take: DISCOVER_LIMIT,
  });
}

/**
 * Finished anime and series for the binge page: those the user follows, with
 * their progress and remaining time, and others to discover.
 */
export async function getFinishedShows(userId: string) {
  const [followingRows, followingSeriesRows, watchedEps, discoverShows, discoverSeriesShows] = await Promise.all([
    followedFinished(userId, 'ANIME'),
    followedFinished(userId, 'SERIES'),
    db.userEpisode.findMany({ where: { userId }, select: { episodeId: true } }),
    discoverFinished(userId, 'ANIME'),
    discoverFinished(userId, 'SERIES'),
  ]);

  const watchedIds = new Set(watchedEps.map(r => r.episodeId));

  const mapFollowing = (rows: typeof followingRows) => rows.map(us => {
    const show = us.show;
    const allEps = show.seasons.flatMap(s => s.episodes);
    const total = allEps.length;
    const watched = countWatched(allEps, watchedIds);
    const remainingHours = Math.round((total - watched) * estimatedRuntime(show) / 60 * 10) / 10;
    return { show, watched, total, remainingHours };
  });

  const mapDiscover = (rows: typeof discoverShows) => rows.map(show => {
    const total = show.seasons.reduce((a, s) => a + s._count.episodes, 0);
    const hours = Math.round(total * estimatedRuntime(show) / 60);
    return { show, total, hours };
  });

  return {
    following: mapFollowing(followingRows),
    followingSeries: mapFollowing(followingSeriesRows),
    discover: mapDiscover(discoverShows),
    discoverSeries: mapDiscover(discoverSeriesShows),
  };
}
