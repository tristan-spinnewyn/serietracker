import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserLists } from '@/lib/services/shared-lists';
import { apiErrorResponse } from '@/lib/api-error';

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    return NextResponse.json(await getUserLists(session.user.id));
  } catch (err) {
    return apiErrorResponse('GET /api/lists', err);
  }
}
