import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { importShowFromTmdb, importShowFromAnilist } from '@/lib/sync/import-show';

const schema = z.union([
  z.object({ tmdbId: z.number().int().positive() }),
  z.object({ anilistId: z.number().int().positive() }),
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  try {
    const show = 'tmdbId' in parsed.data
      ? await importShowFromTmdb(parsed.data.tmdbId)
      : await importShowFromAnilist(parsed.data.anilistId);

    const userId = session.user.id;

    // Ajoute le show importé en PLAN_TO_WATCH (sans écraser un statut existant)
    await db.userShow.upsert({
      where: { userId_showId: { userId, showId: show.id } },
      update: {},
      create: { userId, showId: show.id, status: 'PLAN_TO_WATCH' },
    });

    // Pour les animes : ajoute aussi les prequelles et suites en PLAN_TO_WATCH
    if (show.type === 'ANIME') {
      const relations = await db.showRelation.findMany({
        where: {
          OR: [{ fromShowId: show.id }, { toShowId: show.id }],
          type: { in: ['SEQUEL', 'PREQUEL'] },
        },
        select: { fromShowId: true, toShowId: true },
      });

      const relatedIds = relations.map(r =>
        r.fromShowId === show.id ? r.toShowId : r.fromShowId
      );

      for (const showId of relatedIds) {
        await db.userShow.upsert({
          where: { userId_showId: { userId, showId } },
          update: {},
          create: { userId, showId, status: 'PLAN_TO_WATCH' },
        });
      }
    }

    return NextResponse.json({ id: show.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[import]', message, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
