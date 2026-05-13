import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendPushToUser } from '@/lib/notifications/push';

function verifyToken(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  let sent = 0;

  // ── Épisodes qui sortent AUJOURD'HUI → NEW_EPISODE ───────────────────────

  const todayEps = await db.episode.findMany({
    where: {
      airDate: { gte: today, lt: tomorrow },
      season: { show: { userShows: { some: { notifyEnabled: true } } } },
    },
    include: {
      season: {
        include: {
          show: {
            include: { userShows: { where: { notifyEnabled: true } } },
          },
        },
      },
    },
  });

  for (const ep of todayEps) {
    const show = ep.season.show;
    for (const us of show.userShows) {
      await db.notification.create({
        data: {
          userId: us.userId,
          type: 'NEW_EPISODE',
          title: show.title,
          body: `S${ep.season.number} · E${ep.number} — ${ep.title ?? 'Nouvel épisode'} sort aujourd'hui`,
          showId: show.id,
        },
      });
      await sendPushToUser(us.userId, {
        title: show.title,
        body: `S${ep.season.number} · E${ep.number} est disponible`,
      }).catch(() => null);
      sent++;
    }
  }

  // ── Épisodes qui sortent DEMAIN → EPISODE_TOMORROW ───────────────────────

  const tomorrowEps = await db.episode.findMany({
    where: {
      airDate: { gte: tomorrow, lt: dayAfter },
      season: { show: { userShows: { some: { notifyEnabled: true } } } },
    },
    include: {
      season: {
        include: {
          show: {
            include: { userShows: { where: { notifyEnabled: true } } },
          },
        },
      },
    },
  });

  for (const ep of tomorrowEps) {
    const show = ep.season.show;
    for (const us of show.userShows) {
      // Dedup : pas déjà notifié pour cet épisode aujourd'hui
      const already = await db.notification.findFirst({
        where: {
          userId: us.userId,
          showId: show.id,
          type: 'EPISODE_TOMORROW',
          createdAt: { gte: today },
        },
      });
      if (already) continue;

      await db.notification.create({
        data: {
          userId: us.userId,
          type: 'EPISODE_TOMORROW',
          title: show.title,
          body: `S${ep.season.number} · E${ep.number} sort demain`,
          showId: show.id,
        },
      });
      await sendPushToUser(us.userId, {
        title: `${show.title} — demain`,
        body: `S${ep.season.number} · E${ep.number} sort demain`,
      }).catch(() => null);
      sent++;
    }
  }

  return NextResponse.json({ sent });
}
