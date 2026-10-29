import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { searchShows } from '@/lib/services/show-search';
import { parseAnimeSearchFilters, hasAnimeSearchFilters } from '@/lib/anilist/search-filters';
import type { MediaType } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const typeParam = req.nextUrl.searchParams.get('type');
  const type = typeParam === 'SERIES' || typeParam === 'ANIME' ? typeParam as MediaType : null;
  const onlyMyPlatforms = req.nextUrl.searchParams.get('onlyMyPlatforms') === 'true';
  const animeFilters = parseAnimeSearchFilters(req.nextUrl.searchParams);

  // Anime filters alone are enough to browse; a bare title needs 2 characters
  if (q.length < 2 && !hasAnimeSearchFilters(animeFilters)) return NextResponse.json({ local: [], remote: [] });

  return NextResponse.json(await searchShows(session.user.id, q, type, onlyMyPlatforms, animeFilters));
}
