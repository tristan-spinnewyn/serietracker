import type { ShowStatus } from '@prisma/client';

const BASE = 'https://api.themoviedb.org/3';

function headers() {
  return { Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}` };
}

export interface TmdbSearchResult {
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  type: 'SERIES';
  year: number | null;
  posterPath: string | null;
  overview: string | null;
}

export interface TmdbShowDetail extends TmdbSearchResult {
  status: ShowStatus;
  network: string | null;
  genre: string | null;
  runtime: number | null;
  totalSeasons: number;
  backdropPath: string | null;
  providers: string[];
  providerLinks: Record<string, string>;
  seasons: TmdbSeason[];
}

// TMDB provider_id (France) → clé interne
const TMDB_PROVIDER_MAP: Record<number, string> = {
  8:    'netflix',
  119:  'prime',
  337:  'disney',
  350:  'appletv',
  63:   'canal',
  283:  'crunchyroll',
  1899: 'max',
  493:  'arte',
  2237: 'tf1',
  430:  'hidive',
};

async function fetchProviders(tmdbId: number): Promise<{ providers: string[]; providerLinks: Record<string, string> }> {
  const res = await fetch(
    `${BASE}/tv/${tmdbId}/watch/providers`,
    { headers: headers() },
  );
  if (!res.ok) return { providers: [], providerLinks: {} };
  const data = await res.json();
  const fr = data.results?.FR;
  if (!fr) return { providers: [], providerLinks: {} };

  const all: { provider_id: number }[] = [
    ...(fr.flatrate ?? []),
    ...(fr.free ?? []),
  ];
  const keys = [...new Set(
    all.map(p => TMDB_PROVIDER_MAP[p.provider_id]).filter(Boolean) as string[]
  )];

  // JustWatch link (lien global du show en France)
  const justWatchUrl: string | null = fr.link ?? null;
  const providerLinks: Record<string, string> = {};
  if (justWatchUrl) keys.forEach(k => { providerLinks[k] = justWatchUrl; });

  return { providers: keys, providerLinks };
}

export interface TmdbSeason {
  number: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  episodes: TmdbEpisode[];
}

export interface TmdbEpisode {
  number: number;
  title: string;
  overview: string | null;
  runtime: number | null;
  airDate: Date | null;
  stillPath: string | null;
}

export async function searchTmdb(q: string): Promise<TmdbSearchResult[]> {
  if (!process.env.TMDB_READ_ACCESS_TOKEN) return [];

  const res = await fetch(
    `${BASE}/search/tv?query=${encodeURIComponent(q)}&language=fr-FR&page=1`,
    { headers: headers() }
  );
  if (!res.ok) return [];

  const data = await res.json();
  return (data.results ?? []).slice(0, 10).map((r: Record<string, unknown>) => ({
    tmdbId: r.id as number,
    title: (r.name ?? r.original_name) as string,
    originalTitle: r.original_name as string ?? null,
    type: 'SERIES' as const,
    year: r.first_air_date ? new Date(r.first_air_date as string).getFullYear() : null,
    posterPath: r.poster_path as string ?? null,
    overview: r.overview as string ?? null,
  }));
}

export async function fetchTmdbDetail(tmdbId: number): Promise<TmdbShowDetail | null> {
  if (!process.env.TMDB_READ_ACCESS_TOKEN) return null;

  const res = await fetch(
    `${BASE}/tv/${tmdbId}?language=fr-FR`,
    { headers: headers() }
  );
  if (!res.ok) return null;

  const d = await res.json();

  const seasons: TmdbSeason[] = [];
  for (const s of d.seasons ?? []) {
    if (s.season_number === 0) continue;

    const sRes = await fetch(
      `${BASE}/tv/${tmdbId}/season/${s.season_number}?language=fr-FR`,
      { headers: headers() }
    );
    const sData = sRes.ok ? await sRes.json() : { episodes: [] };

    seasons.push({
      number: s.season_number,
      title: s.name,
      year: s.air_date ? new Date(s.air_date).getFullYear() : null,
      posterPath: s.poster_path ?? null,
      episodes: (sData.episodes ?? []).map((ep: Record<string, unknown>) => ({
        number: ep.episode_number as number,
        title: ep.name as string,
        overview: ep.overview as string ?? null,
        runtime: ep.runtime as number ?? null,
        airDate: ep.air_date ? new Date(ep.air_date as string) : null,
        stillPath: ep.still_path as string ?? null,
      })),
    });
  }

  const genre = (d.genres ?? []).map((g: { name: string }) => g.name).join(' · ') || null;
  const network = d.networks?.[0]?.name ?? null;
  const runtime = d.episode_run_time?.[0] ?? null;
  const { providers, providerLinks } = await fetchProviders(tmdbId);

  return {
    tmdbId,
    title: d.name,
    originalTitle: d.original_name ?? null,
    type: 'SERIES',
    year: d.first_air_date ? new Date(d.first_air_date).getFullYear() : null,
    posterPath: d.poster_path ?? null,
    backdropPath: d.backdrop_path ?? null,
    overview: d.overview ?? null,
    status: mapStatus(d.status),
    network,
    genre,
    runtime,
    totalSeasons: d.number_of_seasons ?? 0,
    providers,
    providerLinks,
    seasons,
  };
}

function mapStatus(s: string): ShowStatus {
  const m: Record<string, ShowStatus> = {
    'Returning Series': 'RETURNING',
    'Ended': 'ENDED',
    'Canceled': 'CANCELED',
    'In Production': 'IN_PRODUCTION',
    'Planned': 'UPCOMING',
  };
  return m[s] ?? 'RETURNING';
}
