'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) return;
  await db.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });
  revalidatePath('/notifications');
}
