import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
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

    return NextResponse.json({ id: show.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[import]', message, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
