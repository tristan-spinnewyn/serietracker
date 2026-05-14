import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const TMDB = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w300';
const ANILIST = 'https://graphql.anilist.co';

function tmdbHeaders() {
  return { Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}` };
}

function currentAnilistSeason(): { season: string; year: number } {
  const m = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  const season = m <= 3 ? 'WINTER' : m <= 6 ? 'SPRING' : m <= 9 ? 'SUMMER' : 'FALL';
  return { season, year };
}

export interface ReleaseItem {
  id: string;
  title: string;
  originalTitle: string | null;
  type: 'MOVIE' | 'SERIES' | 'ANIME';
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  nextAiringDate: string | null;
  nextAiringEpisode: number | null;
  totalEpisodes: number | null;
  totalSeasons: number | null;
  genre: string | null;
  score: number | null;
  status: string;
  overview: string | null;
  network: string | null;
  tmdbId: number | null;
  anilistId: number | null;
  localId: string | null;
  userHasShow: boolean;
}

// ── Films ─────────────────────────────────────────────────────────────────

async function fetchMovies(section: 'now_playing' | 'upcoming'): Promise<ReleaseItem[]> {
  if (!process.env.TMDB_READ_ACCESS_TOKEN) return [];
  const res = await fetch(
    `${TMDB}/movie/${section}?language=fr-FR&region=FR&page=1`,
    { headers: tmdbHeaders(), next: { revalidate: 3600 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).slice(0, 20).map((m: Record<string, unknown>) => ({
    id: `tmdb-movie-${m.id}`,
    title: (m.title ?? m.original_title) as string,
    originalTitle: m.original_title as string ?? null,
    type: 'MOVIE' as const,
    posterUrl: m.poster_path ? `${TMDB_IMG}${m.poster_path}` : null,
    backdropUrl: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : null,
    releaseDate: m.release_date as string ?? null,
    nextAiringDate: null,
    nextAiringEpisode: null,
    totalEpisodes: null,
    totalSeasons: null,
    genre: null,
    score: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : null,
    status: section === 'now_playing' ? 'En salles' : 'À venir',
    overview: m.overview as string ?? null,
    network: null,
    tmdbId: m.id as number,
    anilistId: null,
  }));
}

// ── Séries TV ─────────────────────────────────────────────────────────────

async function fetchSeries(section: 'on_the_air' | 'airing_today'): Promise<ReleaseItem[]> {
  if (!process.env.TMDB_READ_ACCESS_TOKEN) return [];
  const res = await fetch(
    `${TMDB}/tv/${section}?language=fr-FR&page=1`,
    { headers: tmdbHeaders(), next: { revalidate: 3600 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).slice(0, 20).map((s: Record<string, unknown>) => ({
    id: `tmdb-tv-${s.id}`,
    title: (s.name ?? s.original_name) as string,
    originalTitle: s.original_name as string ?? null,
    type: 'SERIES' as const,
    posterUrl: s.poster_path ? `${TMDB_IMG}${s.poster_path}` : null,
    backdropUrl: s.backdrop_path ? `https://image.tmdb.org/t/p/w780${s.backdrop_path}` : null,
    releaseDate: s.first_air_date as string ?? null,
    nextAiringDate: null,
    nextAiringEpisode: null,
    totalEpisodes: null,
    totalSeasons: null,
    genre: null,
    score: s.vote_average ? Math.round((s.vote_average as number) * 10) / 10 : null,
    status: section === 'airing_today' ? 'Aujourd\'hui' : 'En cours',
    overview: s.overview as string ?? null,
    network: (s.origin_country as string[] ?? [])[0] ?? null,
    tmdbId: s.id as number,
    anilistId: null,
  }));
}

// ── Animes AniList ────────────────────────────────────────────────────────

async function fetchAiringAnime(): Promise<ReleaseItem[]> {
  const { season, year } = currentAnilistSeason();
  const query = `
    query ($season: MediaSeason, $year: Int) {
      Page(perPage: 30) {
        media(
          season: $season
          seasonYear: $year
          type: ANIME
          sort: [POPULARITY_DESC]
          status_in: [RELEASING, NOT_YET_RELEASED]
        ) {
          id
          title { romaji english }
          coverImage { large }
          bannerImage
          genres
          averageScore
          episodes
          status
          description(asHtml: false)
          startDate { year month day }
          nextAiringEpisode { episode airingAt }
        }
      }
    }
  `;

  const res = await fetch(ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { season, year } }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const { data } = await res.json();
  if (data?.errors) return [];

  return (data?.Page?.media ?? []).map((m: Record<string, unknown>) => {
    const title = m.title as Record<string, string>;
    const coverImage = m.coverImage as Record<string, string>;
    const nextAiring = m.nextAiringEpisode as { episode: number; airingAt: number } | null;
    const startDate = m.startDate as Record<string, number>;
    const relDate = startDate?.year
      ? `${startDate.year}-${String(startDate.month ?? 1).padStart(2, '0')}-${String(startDate.day ?? 1).padStart(2, '0')}`
      : null;
    return {
      id: `anilist-${m.id}`,
      title: title.english ?? title.romaji,
      originalTitle: title.romaji ?? null,
      type: 'ANIME' as const,
      posterUrl: coverImage?.large ?? null,
      backdropUrl: m.bannerImage as string ?? null,
      releaseDate: relDate,
      nextAiringDate: nextAiring ? new Date(nextAiring.airingAt * 1000).toISOString() : null,
      nextAiringEpisode: nextAiring?.episode ?? null,
      totalEpisodes: m.episodes as number ?? null,
      totalSeasons: null,
      genre: (m.genres as string[] ?? []).slice(0, 3).join(' · ') || null,
      score: m.averageScore ? (m.averageScore as number) / 10 : null,
      status: m.status === 'RELEASING' ? 'En cours' : 'À venir',
      overview: (m.description as string)?.replace(/<[^>]+>/g, '') ?? null,
      network: null,
      tmdbId: null,
      anilistId: m.id as number,
    };
  });
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = req.nextUrl.searchParams.get('type') ?? 'all'; // all | movies | series | anime

  try {
    const [nowPlaying, upcoming, onAir, anime] = await Promise.all([
      (type === 'all' || type === 'movies')  ? fetchMovies('now_playing') : Promise.resolve([]),
      (type === 'all' || type === 'movies')  ? fetchMovies('upcoming')    : Promise.resolve([]),
      (type === 'all' || type === 'series')  ? fetchSeries('on_the_air')  : Promise.resolve([]),
      (type === 'all' || type === 'anime')   ? fetchAiringAnime()         : Promise.resolve([]),
    ]);

    const moviesMap = new Map<string, ReleaseItem>();
    [...nowPlaying, ...upcoming].forEach(m => moviesMap.set(m.id, m));
    const movies = Array.from(moviesMap.values())
      .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''));

    const allItems = [...movies, ...onAir, ...anime];

    // Batch lookup : cherche quels items sont déjà en base
    const anilistIds = allItems.map(i => i.anilistId).filter((id): id is number => id !== null);
    const tmdbIds    = allItems.map(i => i.tmdbId).filter((id): id is number => id !== null);

    const [inDbAnilist, inDbTmdb] = await Promise.all([
      anilistIds.length ? db.show.findMany({ where: { anilistId: { in: anilistIds } }, select: { id: true, anilistId: true } }) : [],
      tmdbIds.length    ? db.show.findMany({ where: { tmdbId:    { in: tmdbIds    } }, select: { id: true, tmdbId:    true } }) : [],
    ]);

    const byAnilist = new Map(inDbAnilist.map(s => [s.anilistId, s.id]));
    const byTmdb    = new Map(inDbTmdb.map(s => [s.tmdbId, s.id]));

    // Vérifie quels shows sont déjà dans la liste de l'utilisateur
    const localIds = [...byAnilist.values(), ...byTmdb.values()];
    const userShows = localIds.length
      ? await db.userShow.findMany({
          where: { userId: session.user.id, showId: { in: localIds } },
          select: { showId: true },
        })
      : [];
    const inUserList = new Set(userShows.map(us => us.showId));

    const withLocalId = (items: ReleaseItem[]) =>
      items.map(i => {
        const localId = i.anilistId ? (byAnilist.get(i.anilistId) ?? null)
                      : i.tmdbId   ? (byTmdb.get(i.tmdbId)    ?? null)
                      : null;
        return { ...i, localId, userHasShow: localId ? inUserList.has(localId) : false };
      });

    return NextResponse.json({
      movies: withLocalId(movies),
      series: withLocalId(onAir),
      anime:  withLocalId(anime),
    });
  } catch (err) {
    console.error('[GET /api/releases]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
