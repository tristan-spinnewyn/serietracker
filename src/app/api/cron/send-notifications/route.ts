import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendPushToUser } from '@/lib/notifications/push';

function verifyToken(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Épisodes qui sortent aujourd'hui pour les users qui suivent le show
  const episodes = await db.episode.findMany({
    where: {
      airDate: { gte: today, lt: tomorrow },
      season: {
        show: {
          userShows: { some: { notifyEnabled: true } },
        },
      },
    },
    include: {
      season: {
        include: {
          show: {
            include: {
              userShows: {
                where: { notifyEnabled: true },
                include: { user: true },
              },
            },
          },
        },
      },
    },
  });

  let sent = 0;

  for (const ep of episodes) {
    const show = ep.season.show;
    for (const userShow of show.userShows) {
      await db.notification.create({
        data: {
          userId: userShow.userId,
          type: 'NEW_EPISODE',
          title: show.title,
          body: `S${ep.season.number} · E${ep.number} — ${ep.title ?? 'Nouvel épisode'} sort aujourd'hui`,
          showId: show.id,
        },
      });

      await sendPushToUser(userShow.userId, {
        title: show.title,
        body: `S${ep.season.number} · E${ep.number} est disponible`,
      }).catch(() => null);

      sent++;
    }
  }

  return NextResponse.json({ sent });
}
