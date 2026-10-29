import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/api-error';
import { getReleases } from '@/lib/services/releases';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = req.nextUrl.searchParams.get('type') ?? 'all'; // all | movies | series | anime

  try {
    return NextResponse.json(await getReleases(session.user.id, type));
  } catch (err) {
    return apiErrorResponse('GET /api/releases', err);
  }
}
