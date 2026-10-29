// Pure helpers about a user's progress through a show.

const DEFAULT_RUNTIME_MINUTES = { ANIME: 24, SERIES: 45 } as const;

/**
 * First episode the user has not watched, in season then episode order.
 * The input arrays are left untouched.
 */
export function findNextUnwatched<E extends { id: string; number: number }>(
  seasons: { number: number; episodes: E[] }[],
  watched: Set<string>,
): (E & { seasonNumber: number }) | null {
  const ordered = [...seasons].sort((a, b) => a.number - b.number);
  for (const s of ordered) {
    const episodes = [...s.episodes].sort((a, b) => a.number - b.number);
    const next = episodes.find(e => !watched.has(e.id));
    if (next) return { ...next, seasonNumber: s.number };
  }
  return null;
}

export function countWatched(episodes: { id: string }[], watched: Set<string>): number {
  return episodes.filter(e => watched.has(e.id)).length;
}

/** Episode length in minutes, falling back to a typical value when TMDB/AniList has none. */
export function estimatedRuntime(show: { runtime: number | null; type: string }): number {
  return show.runtime ?? (show.type === 'ANIME' ? DEFAULT_RUNTIME_MINUTES.ANIME : DEFAULT_RUNTIME_MINUTES.SERIES);
}
