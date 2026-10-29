import type { MediaType, WatchStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { countWatched, estimatedRuntime } from '@/lib/shows/progress';

const STATUSES: WatchStatus[] = ['WATCHING', 'PLAN_TO_WATCH', 'COMPLETED', 'PAUSED', 'DROPPED'];

function totalEpisodes(show: { seasons: { _count: { episodes: number } }[] }) {
  return show.seasons.reduce((a, s) => a + s._count.episodes, 0);
}

function userShowsWithEpisodeCounts(userId: string, filter: { status?: WatchStatus; type?: MediaType }) {
  return db.userShow.findMany({
    where: {
      userId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.type ? { show: { type: filter.type } } : {}),
    },
    include: {
      show: {
        include: {
          seasons: { select: { _count: { select: { episodes: true } } } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * The user's library filtered by status and type: one card per show with its
 * watch progress, plus the per-status and per-type counts of the whole library.
 */
export async function getLibrary(userId: string, filter: { status?: WatchStatus; type?: MediaType }) {
  const userShows = await userShowsWithEpisodeCounts(userId, filter);

  const [watchedEps, allUserShows, episodes] = await Promise.all([
    db.userEpisode.findMany({ where: { userId }, select: { episodeId: true } }),
    // Counts always describe the whole library, not the current filter
    filter.status || filter.type
      ? db.userShow.findMany({ where: { userId }, include: { show: { select: { type: true } } } })
      : Promise.resolve(userShows),
    db.episode.findMany({
      where: { season: { showId: { in: userShows.map(us => us.show.id) } } },
      select: { id: true, season: { select: { showId: true } } },
    }),
  ]);
  const watchedSet = new Set(watchedEps.map(e => e.episodeId));

  const episodesByShow = new Map<string, { id: string }[]>();
  for (const ep of episodes) {
    const list = episodesByShow.get(ep.season.showId) ?? [];
    list.push({ id: ep.id });
    episodesByShow.set(ep.season.showId, list);
  }

  const counts: Record<WatchStatus | MediaType | 'total', number> = {
    total: allUserShows.length,
    ...Object.fromEntries(STATUSES.map(s => [s, allUserShows.filter(us => us.status === s).length])) as Record<WatchStatus, number>,
    ANIME: allUserShows.filter(us => us.show.type === 'ANIME').length,
    SERIES: allUserShows.filter(us => us.show.type === 'SERIES').length,
  };

  const cards = userShows.map(us => ({
    show: us.show,
    status: us.status,
    rating: us.rating,
    totalEps: totalEpisodes(us.show),
    watchedCount: countWatched(episodesByShow.get(us.show.id) ?? [], watchedSet),
  }));

  return { cards, counts };
}

/** Completed shows of the user (optionally of one type) with their total watch time. */
export async function getCompletedShows(userId: string, type?: MediaType) {
  const completed = await userShowsWithEpisodeCounts(userId, { status: 'COMPLETED', type });

  const rows = completed.map(us => {
    const totalEps = totalEpisodes(us.show);
    const hours = Math.round(totalEps * estimatedRuntime(us.show) / 60);
    return { show: us.show, totalEps, hours, rating: us.rating };
  });

  return {
    rows,
    totalHours: rows.reduce((a, r) => a + r.hours, 0),
    totalEps: rows.reduce((a, r) => a + r.totalEps, 0),
    animeCount: completed.filter(us => us.show.type === 'ANIME').length,
    seriesCount: completed.filter(us => us.show.type === 'SERIES').length,
  };
}
