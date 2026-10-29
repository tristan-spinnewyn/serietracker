import { db } from '@/lib/db';
import { posterUrl } from '@/lib/constants';
import { findNextUnwatched, countWatched } from '@/lib/shows/progress';
import type { NowCardData } from '@/components/shows/now-card';
import type { ActivityEntry } from '@/components/shows/activity-row';
import type { UpcomingItem } from '@/components/shows/upcoming-row';

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

/** Everything the dashboard shows: shows in progress, watchlist, this week's episodes and family activity. */
export async function getDashboard(userId: string) {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [watchingRows, planRows, upcomingEps, recentActivity] = await Promise.all([
    // Shows en cours
    db.userShow.findMany({
      where: { userId, status: 'WATCHING' },
      include: { show: { include: { seasons: { include: { episodes: { select: { id: true, number: true, title: true, airDate: true } } } } } } },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
    // À voir
    db.userShow.findMany({
      where: { userId, status: 'PLAN_TO_WATCH' },
      include: { show: true },
      orderBy: { updatedAt: 'desc' },
    }),
    // Épisodes à venir cette semaine
    db.episode.findMany({
      where: {
        airDate: { gte: now, lte: weekEnd },
        season: { show: { userShows: { some: { userId, status: 'WATCHING' } } } },
      },
      include: { season: { include: { show: true } } },
      orderBy: { airDate: 'asc' },
      take: 5,
    }),
    // Activité récente de la famille
    db.userEpisode.findMany({
      include: {
        user: { select: { name: true, color: true, initials: true } },
        episode: { include: { season: { include: { show: true } } } },
      },
      orderBy: { watchedAt: 'desc' },
      take: 7,
    }),
  ]);

  // Épisodes vus par l'user courant (pour calculer next ep)
  const watchedIds = new Set(
    (await db.userEpisode.findMany({ where: { userId }, select: { episodeId: true } })).map(r => r.episodeId)
  );

  const nowCards: NowCardData[] = watchingRows.map(us => {
    const show = us.show;
    const allEps = show.seasons.flatMap(s => s.episodes);
    const nextEpDb = findNextUnwatched(show.seasons, watchedIds);
    return {
      id: show.id,
      title: show.title,
      type: show.type,
      genre: show.genre,
      posterUrl: posterUrl(show),
      watchedCount: countWatched(allEps, watchedIds),
      totalEps: allEps.length,
      nextEp: nextEpDb ? {
        s: nextEpDb.seasonNumber,
        e: nextEpDb.number,
        title: nextEpDb.title ?? `Épisode ${nextEpDb.number}`,
        date: nextEpDb.airDate ? new Date(nextEpDb.airDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '',
      } : null,
    };
  });

  const upcomingItems: UpcomingItem[] = upcomingEps.map(ep => {
    const d = ep.airDate!;
    return {
      showId: ep.season.show.id,
      showTitle: ep.season.show.title,
      type: ep.season.show.type,
      day: d.getDate(),
      month: d.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase(),
      ep: `S${ep.season.number} · E${ep.number}`,
      epTitle: ep.title ?? '',
      notify: true,
    };
  });

  const activityEntries: ActivityEntry[] = recentActivity.map(ue => {
    const show = ue.episode.season.show;
    return {
      id: ue.id,
      userName: ue.user.name,
      userColor: ue.user.color,
      userInitials: ue.user.initials,
      verb: 'a vu',
      showTitle: show.title,
      showType: show.type,
      showPosterUrl: posterUrl(show),
      detail: `S${ue.episode.season.number} · E${ue.episode.number}${ue.episode.title ? ` — ${ue.episode.title}` : ''}`,
      when: timeAgo(ue.watchedAt),
    };
  });

  return { nowCards, upcomingItems, activityEntries, planRows };
}
