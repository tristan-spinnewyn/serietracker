import { db } from '@/lib/db';

/** Finds shows already in the local catalog by title, e.g. to link two shows together. */
export async function searchCatalogShows(q: string) {
  return db.show.findMany({
    where: { title: { contains: q, mode: 'insensitive' } },
    take: 20,
    orderBy: { syncPriority: 'desc' },
    select: { id: true, title: true, type: true, year: true, tmdbId: true, anilistId: true, posterPath: true },
  });
}
