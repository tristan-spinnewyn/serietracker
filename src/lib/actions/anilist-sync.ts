'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { fetchAnilistUserList } from '@/lib/anilist/client';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { importAnilistLibrary } from '@/lib/services/anilist-library-import';

export type SyncResult =
  | { status: 'ok'; imported: number; skipped: number; errors: number }
  | { status: 'not_found' }
  | { status: 'rate_limited' }
  | { status: 'error' };

export async function syncFromAnilist(username: string): Promise<SyncResult> {
  const session = await auth();
  if (!session?.user) return { status: 'error' };
  const userId = session.user.id;

  // Each sync imports a whole AniList library: keep it rare to protect API quotas
  if (!consumeRateLimit(`anilist-sync:${userId}`, RATE_LIMITS.anilistSyncPerUser).allowed) {
    return { status: 'rate_limited' };
  }

  const entries = await fetchAnilistUserList(username.trim());
  if (entries === null) return { status: 'not_found' };

  const counts = await importAnilistLibrary(userId, entries);

  revalidatePath('/dashboard');
  revalidatePath('/settings');
  return { status: 'ok', ...counts };
}
