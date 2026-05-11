import webpush from 'web-push';
import { db } from '@/lib/db';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string }) {
  const subs = await db.pushSubscription.findMany({ where: { userId } });

  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      ).catch(async err => {
        // Supprimer les subscriptions expirées (410 Gone)
        if (err.statusCode === 410) {
          await db.pushSubscription.delete({ where: { id: sub.id } });
        }
      })
    )
  );
}
