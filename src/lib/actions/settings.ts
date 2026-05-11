'use server';

import { revalidatePath } from 'next/cache';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

async function userId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Non authentifié');
  return session.user.id;
}

// ── Profil ───────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name:  z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function updateProfile(data: { name: string; color: string }) {
  const id = await userId();
  const { name, color } = profileSchema.parse(data);
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

  await db.user.update({ where: { id }, data: { name, color, initials } });
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

  const user = await db.user.findUniqueOrThrow({ where: { id } });
  const valid = await compare(current, user.passwordHash);
  if (!valid) return { error: 'Mot de passe actuel incorrect.' };

  await db.user.update({ where: { id }, data: { passwordHash: await hash(next, 12) } });
  return { success: true };
}

// ── Plateformes ───────────────────────────────────────────────────────────

export async function updatePlatforms(platforms: string[]) {
  const id = await userId();
  await db.user.update({ where: { id }, data: { platforms } });
  revalidatePath('/', 'layout');
  return { success: true };
}
