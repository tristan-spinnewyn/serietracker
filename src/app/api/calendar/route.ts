import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const y = parseInt(req.nextUrl.searchParams.get('year') ?? '');
  const m = parseInt(req.nextUrl.searchParams.get('month') ?? '');
  const scope = req.nextUrl.searchParams.get('scope') ?? 'me';

  if (!y || !m) return NextResponse.json({ episodes: [] });

  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 1);

  const episodes = await db.episode.findMany({
    where: {
      airDate: { gte: start, lt: end },
      season: {
        show: {
          userShows: scope === 'me'
            ? { some: { userId: session.user.id } }
            : { some: {} },
        },
      },
    },
    include: { season: { include: { show: true } } },
    orderBy: { airDate: 'asc' },
  });

  return NextResponse.json({
    episodes: episodes.map(e => ({
      id: e.id,
      showId: e.season.show.id,
      showTitle: e.season.show.title,
      showType: e.season.show.type,
      seasonNumber: e.season.number,
      episodeNumber: e.number,
      airDate: e.airDate,
    })),
  });
}
