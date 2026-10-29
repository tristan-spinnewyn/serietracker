import { db } from '@/lib/db';

const RECENT_LIMIT = 50;

/** The user's most recent notifications, newest first. */
export function getRecentNotifications(userId: string) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: RECENT_LIMIT,
  });
}
