// Constantes UI — pas des données mockées
export const PALETTES: [string, string, string][] = [
  ['#3B0764', '#A855F7', '#F0ABFC'],
  ['#0C4A6E', '#0EA5E9', '#7DD3FC'],
  ['#7C2D12', '#FB7185', '#FECDD3'],
  ['#064E3B', '#34D399', '#A7F3D0'],
  ['#422006', '#F59E0B', '#FCD34D'],
  ['#1E1B4B', '#6366F1', '#A5B4FC'],
  ['#4A044E', '#D946EF', '#F5D0FE'],
  ['#831843', '#EC4899', '#FBCFE8'],
  ['#1F2937', '#94A3B8', '#E2E8F0'],
  ['#022C22', '#10B981', '#6EE7B7'],
  ['#451A03', '#EA580C', '#FED7AA'],
  ['#312E81', '#818CF8', '#C7D2FE'],
];

export function paletteFor(seed: string): [string, string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

export const PROVIDERS: Record<string, { id: string; name: string; mono: string; bg: string }> = {
  netflix:     { id: 'netflix',     name: 'Netflix',     mono: 'N', bg: '#E50914' },
  prime:       { id: 'prime',       name: 'Prime Video', mono: 'P', bg: '#00A8E1' },
  disney:      { id: 'disney',      name: 'Disney+',     mono: 'D', bg: '#0D1F3C' },
  canal:       { id: 'canal',       name: 'Canal+',      mono: 'C', bg: '#000000' },
  crunchyroll: { id: 'crunchyroll', name: 'Crunchyroll', mono: 'C', bg: '#F47521' },
  adn:         { id: 'adn',         name: 'ADN',         mono: 'A', bg: '#1B1B1B' },
  max:         { id: 'max',         name: 'Max',         mono: 'M', bg: '#002BE7' },
  appletv:     { id: 'appletv',     name: 'Apple TV+',   mono: '', bg: '#000000' },
  arte:        { id: 'arte',        name: 'Arte',        mono: 'A', bg: '#1E1E1E' },
  francetv:    { id: 'francetv',    name: 'France.tv',   mono: 'F', bg: '#0F2A4A' },
  tf1:         { id: 'tf1',         name: 'TF1+',        mono: 'T', bg: '#0E2A6E' },
  hidive:      { id: 'hidive',      name: 'HIDIVE',      mono: 'H', bg: '#00C2C2' },
};

export const TMDB_IMG_W300 = 'https://image.tmdb.org/t/p/w300';
export const TMDB_IMG_W500 = 'https://image.tmdb.org/t/p/w500';
export const TMDB_IMG_W1280 = 'https://image.tmdb.org/t/p/w1280';

export function posterUrl(show: { tmdbId: number | null; anilistId: number | null; posterPath: string | null }): string | null {
  if (!show.posterPath) return null;
  return show.tmdbId ? `${TMDB_IMG_W500}${show.posterPath}` : show.posterPath;
}

export function backdropUrl(show: { tmdbId: number | null; backdropPath: string | null }): string | null {
  if (!show.backdropPath) return null;
  return show.tmdbId ? `${TMDB_IMG_W1280}${show.backdropPath}` : show.backdropPath;
}
