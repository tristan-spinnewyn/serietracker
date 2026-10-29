import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { searchShows } from '@/lib/services/show-search';
import type { MediaType } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const typeParam = req.nextUrl.searchParams.get('type');
  const type = typeParam === 'SERIES' || typeParam === 'ANIME' ? typeParam as MediaType : null;
  const onlyMyPlatforms = req.nextUrl.searchParams.get('onlyMyPlatforms') === 'true';

  if (q.length < 2) return NextResponse.json({ local: [], remote: [] });

  return NextResponse.json(await searchShows(session.user.id, q, type, onlyMyPlatforms));
}
