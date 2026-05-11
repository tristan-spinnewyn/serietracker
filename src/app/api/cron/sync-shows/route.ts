import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncShow } from '@/lib/sync/sync-show';

function verifyToken(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  let synced = 0;
  let errors = 0;

  // Priorité haute : shows WATCHING
  const watchingShows = await db.show.findMany({
    where: {
      userShows: { some: { status: 'WATCHING' } },
    },
    orderBy: { lastSyncedAt: 'asc' },
    take: 50,
  });

  for (const show of watchingShows) {
    try {
      await syncShow(show.id);
      synced++;
    } catch {
      errors++;
    }
  }

  await db.syncLog.create({
    data: {
      target: 'watching-shows',
      duration: Date.now() - start,
      showsCount: synced,
      errors,
    },
  });

  return NextResponse.json({ synced, errors, duration: Date.now() - start });
}
