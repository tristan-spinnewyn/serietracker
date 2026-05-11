import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { SettingsClient } from './settings-client';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, color: true, initials: true, platforms: true },
  });

  return <SettingsClient user={user} />;
}
