import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { searchCatalogShows } from '@/lib/services/show-catalog-search';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ shows: [] });

  return NextResponse.json({ shows: await searchCatalogShows(q) });
}
