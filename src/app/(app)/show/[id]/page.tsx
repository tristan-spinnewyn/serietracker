import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ShowDetail } from './show-detail';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

function posterUrl(show: { tmdbId: number | null; anilistId: number | null; posterPath: string | null }) {
  if (!show.posterPath) return null;
  return show.tmdbId ? `${TMDB_IMG}${show.posterPath}` : show.posterPath;
}

function backdropUrl(show: { tmdbId: number | null; backdropPath: string | null }) {
  if (!show.backdropPath) return null;
  return show.tmdbId ? `https://image.tmdb.org/t/p/w1280${show.backdropPath}` : show.backdropPath;
}

export default async function ShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) notFound();

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

  if (!show) notFound();

  // Épisodes vus par l'utilisateur courant
  const watchedSet = new Set(
    (await db.userEpisode.findMany({
      where: {
        userId: session.user.id,
        episode: { season: { showId: id } },
      },
      select: { episodeId: true },
    })).map(r => r.episodeId)
  );

  const myUserShow = show.userShows.find(us => us.userId === session.user.id);

  // Prochain épisode = premier non-vu avec airDate passé ou null
  const nextEp = show.seasons
    .flatMap(s => s.episodes.map(e => ({ ...e, seasonNumber: s.number })))
    .find(e => !watchedSet.has(e.id)) ?? null;

  // Autres membres de la famille qui suivent ce show
  const followers = show.userShows
    .filter(us => us.userId !== session.user.id)
    .map(us => {
      // Trouver leur dernier épisode vu
      return { user: us.user, status: us.status };
    });

  const relations = show.relationsFrom.map(r => ({
    id: r.toShow.id,
    title: r.toShow.title,
    type: r.toShow.type,
    year: r.toShow.year,
    status: r.toShow.status,
    posterUrl: posterUrl(r.toShow),
    relationType: r.type,
  }));

  return (
    <ShowDetail
      show={{
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
      }}
      seasons={show.seasons.map(s => ({
        id: s.id,
        number: s.number,
        title: s.title ?? `Saison ${s.number}`,
        year: s.year,
        episodeCount: s.episodes.length,
        watchedCount: s.episodes.filter(e => watchedSet.has(e.id)).length,
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
      }))}
      nextEp={nextEp ? {
        id: nextEp.id,
        seasonNumber: nextEp.seasonNumber,
        episodeNumber: nextEp.number,
        title: nextEp.title ?? `Épisode ${nextEp.number}`,
        airDate: nextEp.airDate
          ? new Date(nextEp.airDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
          : null,
      } : null}
      userStatus={myUserShow?.status ?? null}
      notifyEnabled={myUserShow?.notifyEnabled ?? true}
      followers={followers}
      relations={relations}
    />
  );
}
