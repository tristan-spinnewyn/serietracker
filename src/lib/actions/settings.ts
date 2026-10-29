'use server';

import { revalidatePath } from 'next/cache';
import { changePassword, updateProfile as saveProfile } from '@/lib/services/accounts';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { db } from '@/lib/db';
import { PROVIDERS } from '@/lib/constants';

async function userId() {
  return (await requireSession()).user.id;
}

// ── Profil ───────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name:  z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function updateProfile(data: { name: string; color: string }) {
  const id = await userId();
  await saveProfile(id, profileSchema.parse(data));
  revalidatePath('/', 'layout');
  return { success: true };
}

// ── Mot de passe ─────────────────────────────────────────────────────────

const pwSchema = z.object({
  current: z.string().min(1),
  next:    z.string().min(8),
});

export async function updatePassword(data: { current: string; next: string }) {
  const id = await userId();
  const { current, next } = pwSchema.parse(data);
  return changePassword(id, current, next);
}

// ── Plateformes ───────────────────────────────────────────────────────────

const platformsSchema = z
  .array(z.string().refine(p => Object.hasOwn(PROVIDERS, p), { message: 'Unknown platform' }))
  .transform(list => [...new Set(list)]);

export async function updatePlatforms(rawPlatforms: string[]) {
  const id = await userId();
  const platforms = platformsSchema.parse(rawPlatforms);
  await db.user.update({ where: { id }, data: { platforms } });
  revalidatePath('/', 'layout');
  return { success: true };
}
