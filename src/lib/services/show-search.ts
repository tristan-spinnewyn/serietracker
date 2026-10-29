import { db } from '@/lib/db';
import { searchTmdb } from '@/lib/tmdb/client';
import { searchAnilist } from '@/lib/anilist/client';
import { hasAnimeSearchFilters, type AnimeSearchFilters } from '@/lib/anilist/search-filters';
import type { MediaType, Prisma } from '@prisma/client';

const withUserStatus = (userId: string) => ({
  userShows: {
    where: { userId },
    select: { status: true },
  },
});

/** Narrows local shows to the user's platforms when asked to. */
async function platformFilter(userId: string, onlyMyPlatforms: boolean): Promise<Prisma.ShowWhereInput> {
  if (!onlyMyPlatforms) return {};
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { platforms: true },
  });
  const platforms = user?.platforms ?? [];
  return platforms.length ? { providers: { hasSome: platforms } } : {};
}

/**
 * Searches the local catalog first, then TMDB and AniList when fewer than
 * five local shows match, leaving out remote results already imported.
 * With anime filters (genre, season), browses AniList instead and splits
 * its results between shows already in the catalog and new ones.
 */
export async function searchShows(
  userId: string,
  q: string,
  type: MediaType | null,
  onlyMyPlatforms: boolean,
  animeFilters: AnimeSearchFilters = {},
) {
  if (hasAnimeSearchFilters(animeFilters)) {
    return browseAnilist(userId, q, animeFilters, onlyMyPlatforms);
  }

  // ── 1. Base locale ───────────────────────────────────────────────────────
  const local = await db.show.findMany({
    where: {
      title: { contains: q, mode: 'insensitive' },
      ...(type ? { type } : {}),
      ...(await platformFilter(userId, onlyMyPlatforms)),
    },
    take: 20,
    orderBy: { syncPriority: 'desc' },
    include: withUserStatus(userId),
  });

  // ── 2. Fallback remote si moins de 5 résultats locaux ────────────────────
  let remote: unknown[] = [];
  if (local.length < 5) {
    const [tmdb, anilist] = await Promise.allSettled([
      type !== 'ANIME'  ? searchTmdb(q)    : Promise.resolve([]),
      type !== 'SERIES' ? searchAnilist(q) : Promise.resolve([]),
    ]);

    const localTmdbIds = new Set(local.map(s => s.tmdbId).filter(Boolean));
    const localAniIds  = new Set(local.map(s => s.anilistId).filter(Boolean));

    const tmdbResults    = tmdb.status    === 'fulfilled' ? tmdb.value    : [];
    const anilistResults = anilist.status === 'fulfilled' ? anilist.value : [];

    remote = [
      ...tmdbResults.filter(r => !localTmdbIds.has(r.tmdbId)),
      ...anilistResults.filter(r => !localAniIds.has(r.anilistId)),
    ];
  }

  return { local, remote };
}

async function browseAnilist(userId: string, q: string, filters: AnimeSearchFilters, onlyMyPlatforms: boolean) {
  const results = await searchAnilist(q, filters);
  if (!results.length) return { local: [], remote: [] };

  const local = await db.show.findMany({
    where: {
      anilistId: { in: results.map(r => r.anilistId) },
      ...(await platformFilter(userId, onlyMyPlatforms)),
    },
    include: withUserStatus(userId),
  });

  const localAniIds = new Set(local.map(s => s.anilistId));
  return { local, remote: results.filter(r => !localAniIds.has(r.anilistId)) };
}
