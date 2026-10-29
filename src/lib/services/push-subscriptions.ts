import { db } from '@/lib/db';

interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Stores or refreshes the user's subscription for a browser endpoint.
 * Returns false when the endpoint belongs to another user, whose keys must
 * never be overwritten.
 */
export async function saveSubscription(userId: string, { endpoint, keys }: Subscription): Promise<boolean> {
  const existing = await db.pushSubscription.findUnique({
    where: { endpoint },
    select: { userId: true },
  });
  if (existing && existing.userId !== userId) return false;

  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  return true;
}

/** Removes the user's own subscription for an endpoint, if any. */
export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { endpoint, userId } });
}
