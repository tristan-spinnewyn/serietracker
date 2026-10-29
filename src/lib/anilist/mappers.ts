import type { ShowStatus } from '@prisma/client';

// Pure helpers turning AniList payloads into our data.

/**
 * Nettoie le HTML d'une chaîne (ex: balises retournées par AniList).
 * Boucle tant qu'il reste des balises pour éviter les résidus imbriqués (CodeQL).
 */
export function stripHtml(text: string | null | undefined): string | null {
  if (!text) return null;
  let clean = text;
  while (clean.includes('<')) {
    const start = clean.indexOf('<');
    const end = clean.indexOf('>', start);
    if (end === -1) {
      clean = clean.slice(0, start);
      break;
    }
    clean = clean.slice(0, start) + clean.slice(end + 1);
  }
  clean = clean.replaceAll('>', '');
  return clean.trim() || null;
}

export interface AnilistEpisode {
  number: number;
  airDate: Date | null;
}

// Fusionne airingSchedule + Media.episodes : AniList ne fournit pas toujours
// le schedule complet pour les vieux animes finis. On comble avec des épisodes
// sans airDate pour que le compte total soit correct.
export function buildAnilistEpisodes(
  scheduleNodes: Array<{ episode: number; airingAt: number }> | null | undefined,
  totalEpisodes: number | null | undefined,
): AnilistEpisode[] {
  const byNumber = new Map<number, AnilistEpisode>();
  for (const n of scheduleNodes ?? []) {
    byNumber.set(n.episode, { number: n.episode, airDate: new Date(n.airingAt * 1000) });
  }
  const maxScheduled = byNumber.size ? Math.max(...byNumber.keys()) : 0;
  const total = Math.max(totalEpisodes ?? 0, maxScheduled);
  for (let i = 1; i <= total; i++) {
    if (!byNumber.has(i)) byNumber.set(i, { number: i, airDate: null });
  }
  return Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
}

export function mapAnilistStatus(s: string): ShowStatus {
  const m: Record<string, ShowStatus> = {
    FINISHED: 'ENDED',
    RELEASING: 'RETURNING',
    NOT_YET_RELEASED: 'UPCOMING',
    CANCELLED: 'CANCELED',
  };
  return m[s] ?? 'RETURNING';
}

const ANILIST_SITE_MAP: Record<string, string> = {
  'Crunchyroll':               'crunchyroll',
  'Netflix':                   'netflix',
  'ADN':                       'adn',
  'Animation Digital Network': 'adn',
  'Amazon Prime Video':        'prime',
  'Disney Plus':               'disney',
  'HIDIVE':                    'hidive',
  'Apple TV Plus':             'appletv',
  'Canal+':                    'canal',
};

export function parseAnilistProviders(links: Array<{ site: string; type: string; url?: string }>): string[] {
  const keys = links
    .filter(l => l.type === 'STREAMING')
    .map(l => ANILIST_SITE_MAP[l.site])
    .filter(Boolean) as string[];
  return [...new Set(keys)];
}

export function parseAnilistProviderLinks(links: Array<{ site: string; type: string; url?: string }>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const l of links) {
    if (l.type !== 'STREAMING' || !l.url) continue;
    const key = ANILIST_SITE_MAP[l.site];
    if (key) result[key] = l.url;
  }
  return result;
}

