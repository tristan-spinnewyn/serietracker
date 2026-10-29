import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCalendarEpisodes } from '@/lib/services/calendar';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const y = parseInt(req.nextUrl.searchParams.get('year') ?? '');
  const m = parseInt(req.nextUrl.searchParams.get('month') ?? '');
  const scope = req.nextUrl.searchParams.get('scope') ?? 'me';

  if (!y || !m) return NextResponse.json({ episodes: [] });

  return NextResponse.json(await getCalendarEpisodes(session.user.id, y, m, scope));
}
