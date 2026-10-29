import { db } from '@/lib/db';
import { TMDB_BASE, tmdbHeaders, mapTmdbStatus, fetchTmdbProviders } from '@/lib/tmdb/client';
import type { ShowStatus } from '@prisma/client';

// ── TMDB ──────────────────────────────────────────────────────────────────────

export async function syncFromTmdb(
  showId: string,
  tmdbId: number,
  prevTotalSeasons: number,
): Promise<{ newStatus: ShowStatus; newTotalSeasons: number }> {
  if (!process.env.TMDB_READ_ACCESS_TOKEN) throw new Error('TMDB_READ_ACCESS_TOKEN manquant');

  const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}?language=fr-FR`, { headers: tmdbHeaders() });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();

  const newStatus = mapTmdbStatus(data.status);
  const newTotalSeasons: number = data.number_of_seasons ?? 0;

  // Keeps the current providers when TMDB has no French data
  const providerUpdate = (await fetchTmdbProviders(tmdbId)) ?? {};

  await db.show.update({
    where: { id: showId },
    data: {
      title: data.name,
      status: newStatus,
      overview: data.overview,
      posterPath: data.poster_path ?? null,
      backdropPath: data.backdrop_path ?? null,
      totalSeasons: newTotalSeasons,
      ...providerUpdate,
    },
  });

  // Sync uniquement les saisons nouvelles + la saison en cours (épisodes récents)
  const allSeasons: Array<{ season_number: number; name: string; air_date: string; poster_path: string }> =
    (data.seasons ?? []).filter((s: { season_number: number }) => s.season_number > 0);

  const seasonsToSync = allSeasons.filter(s =>
    s.season_number > prevTotalSeasons || s.season_number === newTotalSeasons,
  );

  for (const s of seasonsToSync) {
    const season = await db.season.upsert({
      where: { showId_number: { showId, number: s.season_number } },
      update: { title: s.name, year: s.air_date ? new Date(s.air_date).getFullYear() : null },
      create: {
        showId,
        number: s.season_number,
        title: s.name,
        year: s.air_date ? new Date(s.air_date).getFullYear() : null,
        posterPath: s.poster_path ?? null,
      },
    });

    const sRes = await fetch(
      `${TMDB_BASE}/tv/${tmdbId}/season/${s.season_number}?language=fr-FR`,
      { headers: tmdbHeaders() },
    );
    if (!sRes.ok) continue;
    const sData = await sRes.json();

    for (const ep of sData.episodes ?? []) {
      await db.episode.upsert({
        where: { seasonId_number: { seasonId: season.id, number: ep.episode_number } },
        update: {
          title: ep.name,
          overview: ep.overview ?? null,
          runtime: ep.runtime ?? null,
          airDate: ep.air_date ? new Date(ep.air_date) : null,
        },
        create: {
          seasonId: season.id,
          number: ep.episode_number,
          title: ep.name,
          overview: ep.overview ?? null,
          runtime: ep.runtime ?? null,
          airDate: ep.air_date ? new Date(ep.air_date) : null,
          stillPath: ep.still_path ?? null,
        },
      });
    }
  }

  return { newStatus, newTotalSeasons };
}
