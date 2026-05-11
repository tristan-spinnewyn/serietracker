import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const lists = await db.sharedList.findMany({
      where: { members: { some: { userId: session.user.id } } },
      select: {
        id: true,
        name: true,
        emoji: true,
        color: true,
        members: {
          select: {
            user: {
              select: { id: true, name: true, color: true, initials: true },
            },
          },
        },
        items: {
          select: {
            id: true,
            addedBy: {
              select: { name: true, color: true, initials: true },
            },
            show: {
              select: {
                id: true, title: true, type: true, year: true,
                network: true, tmdbId: true, anilistId: true, posterPath: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ lists });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /api/lists]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
