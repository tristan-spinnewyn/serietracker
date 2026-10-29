import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserSettings } from '@/lib/services/user-settings';
import { SettingsClient } from './settings-client';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const userId = session.user.id;

  const { user, stats } = await getUserSettings(userId);

  return <SettingsClient user={user} stats={stats} vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ''} />;
}
