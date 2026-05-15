import { db } from '@/lib/db';
import { fetchTmdbDetail } from '@/lib/tmdb/client';
import { fetchAnilistDetail } from '@/lib/anilist/client';
import { nextSyncMs } from '@/lib/sync/sync-show';
import type { Show, RelationType } from '@prisma/client';
import type { TmdbSeason } from '@/lib/tmdb/client';

const RELATION_MAP: Record<string, RelationType> = {
  SEQUEL:      'SEQUEL',
  PREQUEL:     'PREQUEL',
  SIDE_STORY:  'SPINOFF',
  ALTERNATIVE: 'ALTERNATIVE',
  PARENT:      'PARENT',
  OTHER:       'RELATED',
};

// ── TMDB ──────────────────────────────────────────────────────────────────────

export async function importShowFromTmdb(tmdbId: number): Promise<Show> {
  const existing = await db.show.findUnique({ where: { tmdbId } });
  if (existing) return existing;

  const detail = await fetchTmdbDetail(tmdbId);
  if (!detail) throw new Error(`TMDB ${tmdbId} introuvable`);

  const show = await db.show.create({
    data: {
      tmdbId,
      title: detail.title,
      originalTitle: detail.originalTitle,
      type: 'SERIES',
      status: detail.status,
      genre: detail.genre,
      network: detail.network,
      overview: detail.overview,
      posterPath: detail.posterPath,
      backdropPath: detail.backdropPath,
      year: detail.year,
      runtime: detail.runtime,
      totalSeasons: detail.totalSeasons,
      providers: detail.providers,
      providerLinks: detail.providerLinks,
      syncPriority: 0,
      lastSyncedAt: new Date(),
      nextSyncAt: new Date(Date.now() + nextSyncMs(detail.status)),
    },
  });

  await syncSeasons(show.id, detail.seasons);
  return show;
}

// ── AniList ───────────────────────────────────────────────────────────────────
// visited = set d'anilistId déjà traités dans cette session d'import,
// pour éviter les cycles (S4 → S5 → S4 → …).

export async function importShowFromAnilist(
  anilistId: number,
  visited: Set<number> = new Set(),
  skipRelations = false,
): Promise<Show> {
  const existing = await db.show.findUnique({ where: { anilistId } });
  if (existing) {
    // Appel récursif déjà traité → cycle break
    if (visited.has(anilistId)) return existing;
    // Premier passage sur ce show : marquer puis reconstruire la chaîne de relations
    // avec les autres shows déjà en base (utile au re-import quand des liens manquent)
    visited.add(anilistId);
    if (!skipRelations) {
      await syncExistingRelationsChain(existing.id, anilistId, visited);
    }
    return existing;
  }

  // Marquer comme "en cours d'import" pour couper les cycles
  if (visited.has(anilistId)) {
    // L'entrée sera créée par l'appel parent — on retourne un placeholder vide
    // qui sera remplacé dès que l'appel parent finit.
    throw new Error(`Cycle détecté pour AniList ${anilistId}, skip`);
  }
  visited.add(anilistId);

  const detail = await fetchAnilistDetail(anilistId);
  if (!detail) throw new Error(`AniList ${anilistId} introuvable`);

  const show = await db.show.create({
    data: {
      anilistId,
      title: detail.title,
      originalTitle: detail.originalTitle,
      type: 'ANIME',
      status: detail.status,
      genre: detail.genre,
      network: detail.network,
      overview: detail.overview,
      posterPath: detail.posterPath,
      backdropPath: detail.backdropPath,
      year: detail.year,
      runtime: detail.runtime,
      totalSeasons: detail.totalSeasons,
      providers: detail.providers,
      providerLinks: detail.providerLinks,
      syncPriority: 0,
      lastSyncedAt: new Date(),
      nextSyncAt: new Date(Date.now() + nextSyncMs(detail.status)),
    },
  });

  // Épisodes de la saison
  if (detail.episodes.length > 0) {
    const season = await db.season.create({
      data: { showId: show.id, number: 1, title: 'Saison 1', year: detail.year },
    });
    for (const ep of detail.episodes) {
      await db.episode.upsert({
        where: { seasonId_number: { seasonId: season.id, number: ep.number } },
        update: { airDate: ep.airDate },
        create: { seasonId: season.id, number: ep.number, airDate: ep.airDate },
      });
    }
  }

  if (skipRelations) return show;

  // Relations — on propage le même visited pour suivre toute la chaîne
  // S5 → S4 → S3 → S2 → S1 sans limite de profondeur, juste sans cycles
  for (const rel of detail.relations) {
    try {
      const relShow = await importShowFromAnilist(rel.anilistId, visited);
      const relType = RELATION_MAP[rel.relationType] ?? 'RELATED';

      await db.showRelation.upsert({
        where: { fromShowId_toShowId: { fromShowId: show.id, toShowId: relShow.id } },
        update: {},
        create: { fromShowId: show.id, toShowId: relShow.id, type: relType },
      });
      await db.showRelation.upsert({
        where: { fromShowId_toShowId: { fromShowId: relShow.id, toShowId: show.id } },
        update: {},
        create: { fromShowId: relShow.id, toShowId: show.id, type: inverseType(relType) },
      });
    } catch {
      // Import partiel acceptable (cycle coupé ou show introuvable)
    }
  }

  return show;
}

function inverseType(t: RelationType): RelationType {
  if (t === 'SEQUEL')  return 'PREQUEL';
  if (t === 'PREQUEL') return 'SEQUEL';
  if (t === 'PARENT')  return 'SPINOFF';
  return t;
}

// Pour un show déjà en base : crée/répare les liens avec les autres shows en base
// puis propage récursivement la même opération à chaque show lié non-encore-visité.
// Permet au re-import d'une saison de rebrancher toute la chaîne (S1↔S2↔S3↔…).
async function syncExistingRelationsChain(
  showId: string,
  anilistId: number,
  visited: Set<number>,
): Promise<void> {
  const detail = await fetchAnilistDetail(anilistId);
  if (!detail) return;

  for (const rel of detail.relations) {
    try {
      const relShow = await db.show.findUnique({
        where: { anilistId: rel.anilistId },
        select: { id: true },
      });
      if (!relShow) continue; // pas en base → on n'importe pas, juste on relie ce qui existe

      const relType = RELATION_MAP[rel.relationType] ?? 'RELATED';
      await db.showRelation.upsert({
        where: { fromShowId_toShowId: { fromShowId: showId, toShowId: relShow.id } },
        update: {},
        create: { fromShowId: showId, toShowId: relShow.id, type: relType },
      });
      await db.showRelation.upsert({
        where: { fromShowId_toShowId: { fromShowId: relShow.id, toShowId: showId } },
        update: {},
        create: { fromShowId: relShow.id, toShowId: showId, type: inverseType(relType) },
      });

      if (!visited.has(rel.anilistId)) {
        visited.add(rel.anilistId);
        await syncExistingRelationsChain(relShow.id, rel.anilistId, visited);
      }
    } catch { /* skip */ }
  }
}

async function syncSeasons(showId: string, seasons: TmdbSeason[]) {
  for (const s of seasons) {
    const season = await db.season.upsert({
      where: { showId_number: { showId, number: s.number } },
      update: { title: s.title, year: s.year },
      create: { showId, number: s.number, title: s.title, year: s.year, posterPath: s.posterPath },
    });
    for (const ep of s.episodes) {
      await db.episode.upsert({
        where: { seasonId_number: { seasonId: season.id, number: ep.number } },
        update: { title: ep.title, overview: ep.overview, runtime: ep.runtime, airDate: ep.airDate },
        create: {
          seasonId: season.id,
          number: ep.number,
          title: ep.title,
          overview: ep.overview,
          runtime: ep.runtime,
          airDate: ep.airDate,
          stillPath: ep.stillPath,
        },
      });
    }
  }
}
