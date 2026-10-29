import { db } from '@/lib/db';
import { posterUrl, backdropUrl } from '@/lib/constants';
import { findNextUnwatched, countWatched } from '@/lib/shows/progress';

/** Props of the show page for one user, or null when the show does not exist. */
export async function getShowDetail(id: string, userId: string) {
  const show = await db.show.findUnique({
    where: { id },
    include: {
      seasons: {
        orderBy: { number: 'asc' },
        include: { episodes: { orderBy: { number: 'asc' } } },
      },
      userShows: {
        include: { user: { select: { id: true, name: true, color: true, initials: true } } },
      },
      relationsFrom: {
        include: { toShow: { select: { id: true, title: true, type: true, year: true, tmdbId: true, anilistId: true, posterPath: true, status: true } } },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!show) return null;

  // Épisodes vus par l'utilisateur courant
  const watchedSet = new Set(
    (await db.userEpisode.findMany({
      where: {
        userId: userId,
        episode: { season: { showId: id } },
      },
      select: { episodeId: true },
    })).map(r => r.episodeId)
  );

  const myUserShow = show.userShows.find(us => us.userId === userId);

  const nextEp = findNextUnwatched(show.seasons, watchedSet);

  // Other family members following this show
  const followers = show.userShows
    .filter(us => us.userId !== userId)
    .map(us => ({ user: us.user, status: us.status }));

  const relations = show.relationsFrom.map(r => ({
    id: r.toShow.id,
    title: r.toShow.title,
    type: r.toShow.type,
    year: r.toShow.year,
    status: r.toShow.status,
    posterUrl: posterUrl(r.toShow),
    relationType: r.type,
  }));

  return {
    show: {
      id: show.id,
      title: show.title,
      type: show.type,
      status: show.status,
      year: show.year,
      overview: show.overview,
      posterUrl: posterUrl(show),
      backdropUrl: backdropUrl(show),
      network: show.network,
      genre: show.genre,
      runtime: show.runtime,
      totalSeasons: show.totalSeasons,
      providers: show.providers,
      providerLinks: show.providerLinks as Record<string, string>,
    },
    seasons: show.seasons.map(s => ({
      id: s.id,
      number: s.number,
      title: s.title ?? `Saison ${s.number}`,
      year: s.year,
      episodeCount: s.episodes.length,
      watchedCount: countWatched(s.episodes, watchedSet),
      episodes: s.episodes.map(e => ({
        id: e.id,
        number: e.number,
        title: e.title ?? `Épisode ${e.number}`,
        runtime: e.runtime ? `${e.runtime} min` : '—',
        airDate: e.airDate ? new Date(e.airDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—',
        watched: watchedSet.has(e.id),
        isNext: e.id === nextEp?.id,
        hasAired: !e.airDate || e.airDate <= new Date(),
      })),
    })),
    nextEp: nextEp ? {
      id: nextEp.id,
      seasonNumber: nextEp.seasonNumber,
      episodeNumber: nextEp.number,
      title: nextEp.title ?? `Épisode ${nextEp.number}`,
      airDate: nextEp.airDate
        ? new Date(nextEp.airDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
        : null,
    } : null,
    userStatus: myUserShow?.status ?? null,
    notifyEnabled: myUserShow?.notifyEnabled ?? true,
    userRating: myUserShow?.rating ?? null,
    followers,
    relations,
  };
}
