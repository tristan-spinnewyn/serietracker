import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';

/** Session of the signed-in user, for server actions that require one. */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Non authentifié');
  return session;
}
