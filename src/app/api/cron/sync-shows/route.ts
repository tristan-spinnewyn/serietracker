import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncShow, batchSyncAnilistShows } from '@/lib/sync/sync-show';

// TMDB : 1 appel principal + ~N appels saisons par show → 100 shows ≈ 500 appels
// AniList : 1 appel GraphQL par tranche de 50 grâce à id_in → 200 shows ≈ 4 appels
const TMDB_BATCH    = 100;
const ANILIST_BATCH = 200;

function verifyToken(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  const now = new Date();

  const [tmdbShows, anilistShows] = await Promise.all([
    db.show.findMany({
      where: {
        tmdbId: { not: null },
        OR: [{ nextSyncAt: { lte: now } }, { nextSyncAt: null }],
      },
      orderBy: { nextSyncAt: { sort: 'asc', nulls: 'first' } },
      take: TMDB_BATCH,
      select: { id: true, title: true, tmdbId: true, anilistId: true, status: true, totalSeasons: true },
    }),
    db.show.findMany({
      where: {
        anilistId: { not: null },
        OR: [{ nextSyncAt: { lte: now } }, { nextSyncAt: null }],
      },
      orderBy: { nextSyncAt: { sort: 'asc', nulls: 'first' } },
      take: ANILIST_BATCH,
      select: { id: true, title: true, tmdbId: true, anilistId: true, status: true, totalSeasons: true },
    }),
  ]);

  let synced = 0;
  let errors = 0;

  // AniList — une requête GraphQL par tranche de 50
  const anilistResult = await batchSyncAnilistShows(
    anilistShows.filter(s => s.anilistId !== null) as typeof anilistShows & { anilistId: number }[],
  );
  synced += anilistResult.synced;
  errors += anilistResult.errors;

  // TMDB — appels individuels (pas de batch possible côté API)
  for (const show of tmdbShows) {
    try {
      await syncShow(show.id);
      synced++;
    } catch {
      errors++;
    }
  }

  const duration = Date.now() - start;
  await db.syncLog.create({
    data: { target: 'auto-sync', duration, showsCount: synced, errors },
  });

  return NextResponse.json({
    synced,
    errors,
    duration,
    tmdb: tmdbShows.length,
    anilist: anilistShows.length,
  });
}
