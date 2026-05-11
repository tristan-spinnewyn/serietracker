import { db } from '@/lib/db';

export async function syncShow(showId: string): Promise<void> {
  const show = await db.show.findUniqueOrThrow({ where: { id: showId } });

  // Dispatcher selon le type et la source
  if (show.tmdbId) {
    await syncFromTmdb(show.id, show.tmdbId);
  } else if (show.anilistId) {
    await syncFromAnilist(show.id, show.anilistId);
  }

  await db.show.update({
    where: { id: showId },
    data: { lastSyncedAt: new Date() },
  });
}

async function syncFromTmdb(showId: string, tmdbId: number): Promise<void> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) return;

  const res = await fetch(
    `https://api.themoviedb.org/3/tv/${tmdbId}?language=fr-FR`,
    { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 3600 } }
  );
  if (!res.ok) throw new Error(`TMDB ${res.status}`);

  const data = await res.json();

  await db.show.update({
    where: { id: showId },
    data: {
      title: data.name,
      status: mapTmdbStatus(data.status),
      overview: data.overview,
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      totalSeasons: data.number_of_seasons,
    },
  });

  // Sync seasons + episodes
  for (const s of data.seasons ?? []) {
    if (s.season_number === 0) continue; // ignorer les "specials"

    const season = await db.season.upsert({
      where: { showId_number: { showId, number: s.season_number } },
      update: { title: s.name, year: s.air_date ? new Date(s.air_date).getFullYear() : null },
      create: {
        showId,
        number: s.season_number,
        title: s.name,
        year: s.air_date ? new Date(s.air_date).getFullYear() : null,
        posterPath: s.poster_path,
      },
    });

    // Détails de la saison pour avoir les épisodes
    const detailRes = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/season/${s.season_number}?language=fr-FR`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 3600 } }
    );
    if (!detailRes.ok) continue;
    const detail = await detailRes.json();

    for (const ep of detail.episodes ?? []) {
      await db.episode.upsert({
        where: { seasonId_number: { seasonId: season.id, number: ep.episode_number } },
        update: {
          title: ep.name,
          overview: ep.overview,
          runtime: ep.runtime,
          airDate: ep.air_date ? new Date(ep.air_date) : null,
        },
        create: {
          seasonId: season.id,
          number: ep.episode_number,
          title: ep.name,
          overview: ep.overview,
          runtime: ep.runtime,
          airDate: ep.air_date ? new Date(ep.air_date) : null,
          stillPath: ep.still_path,
        },
      });
    }
  }
}

async function syncFromAnilist(showId: string, anilistId: number): Promise<void> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id title { romaji english native }
        status episodes duration
        coverImage { large extraLarge }
        bannerImage description
        airingSchedule(notYetAired: false) {
          nodes { episode airingAt }
        }
      }
    }
  `;

  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id: anilistId } }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);

  const { data } = await res.json();
  const media = data?.Media;
  if (!media) return;

  await db.show.update({
    where: { id: showId },
    data: {
      title: media.title.french ?? media.title.english ?? media.title.romaji,
      status: mapAnilistStatus(media.status),
      overview: media.description?.replace(/<[^>]+>/g, '') ?? null,
      posterPath: media.coverImage?.extraLarge ?? null,
      backdropPath: media.bannerImage ?? null,
    },
  });
}

function mapTmdbStatus(s: string) {
  const map: Record<string, string> = {
    'Returning Series': 'RETURNING',
    'Ended': 'ENDED',
    'Canceled': 'CANCELED',
    'In Production': 'IN_PRODUCTION',
    'Planned': 'UPCOMING',
  };
  return (map[s] ?? 'RETURNING') as 'RETURNING' | 'ENDED' | 'CANCELED' | 'IN_PRODUCTION' | 'UPCOMING';
}

function mapAnilistStatus(s: string) {
  const map: Record<string, string> = {
    'FINISHED': 'ENDED',
    'RELEASING': 'RETURNING',
    'NOT_YET_RELEASED': 'UPCOMING',
    'CANCELLED': 'CANCELED',
  };
  return (map[s] ?? 'RETURNING') as 'RETURNING' | 'ENDED' | 'CANCELED' | 'IN_PRODUCTION' | 'UPCOMING';
}
