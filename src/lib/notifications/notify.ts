import type { NotifType } from '@prisma/client';
import { db } from '@/lib/db';
import { sendPushToUser } from '@/lib/notifications/push';

export interface NotificationPayload {
  userId: string;
  type: NotifType;
  title: string;
  body: string;
  showId: string;
}

/**
 * Stores in-app notifications, then sends each user a single push with their
 * first notification so a batch never floods a device. Push failures are ignored.
 */
export async function notifyUsers(notifs: NotificationPayload[]): Promise<void> {
  if (!notifs.length) return;

  await db.notification.createMany({ data: notifs });

  const firstPerUser = new Map<string, NotificationPayload>();
  for (const n of notifs) if (!firstPerUser.has(n.userId)) firstPerUser.set(n.userId, n);

  await Promise.allSettled(
    [...firstPerUser.values()].map(n => sendPushToUser(n.userId, { title: n.title, body: n.body })),
  );
}
