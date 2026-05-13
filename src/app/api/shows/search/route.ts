import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { searchTmdb } from '@/lib/tmdb/client';
import { searchAnilist } from '@/lib/anilist/client';
import type { MediaType } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const typeParam = req.nextUrl.searchParams.get('type');
  const type = typeParam === 'SERIES' || typeParam === 'ANIME' ? typeParam as MediaType : null;
  const onlyMyPlatforms = req.nextUrl.searchParams.get('onlyMyPlatforms') === 'true';

  if (q.length < 2) return NextResponse.json({ local: [], remote: [] });

  let userPlatforms: string[] = [];
  if (onlyMyPlatforms) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { platforms: true },
    });
    userPlatforms = user?.platforms ?? [];
  }

  // ── 1. Base locale ───────────────────────────────────────────────────────
  const local = await db.show.findMany({
    where: {
      title: { contains: q, mode: 'insensitive' },
      ...(type ? { type } : {}),
      ...(onlyMyPlatforms && userPlatforms.length
        ? { providers: { hasSome: userPlatforms } }
        : {}),
    },
    take: 20,
    orderBy: { syncPriority: 'desc' },
    include: {
      userShows: {
        where: { userId: session.user.id },
        select: { status: true },
      },
    },
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

  return NextResponse.json({ local, remote });
}
