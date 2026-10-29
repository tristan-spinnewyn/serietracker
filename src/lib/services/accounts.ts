import { compare, hash } from 'bcryptjs';
import { db } from '@/lib/db';

const BCRYPT_COST = 12;
const AVATAR_COLORS = ['#A855F7', '#FB7185', '#34D399', '#FBBF24', '#60A5FA'];

/** Up to two initials from a display name ("Jean Paul" → "JP"). */
export function initialsFor(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/** Creates an account with a random avatar color. The email must already be normalized. */
export async function createAccount(
  { name, email, password }: { name: string; email: string; password: string },
): Promise<{ error: string } | { success: true }> {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: 'Un compte existe déjà avec cet email.' };

  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  await db.user.create({
    data: { name, email, passwordHash: await hash(password, BCRYPT_COST), initials: initialsFor(name), color },
  });
  return { success: true };
}

/**
 * Replaces the password after checking the current one, and bumps the session
 * version so every session opened before the change is revoked.
 */
export async function changePassword(
  userId: string,
  current: string,
  next: string,
): Promise<{ error: string } | { success: true }> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await compare(current, user.passwordHash))) return { error: 'Mot de passe actuel incorrect.' };

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hash(next, BCRYPT_COST), sessionVersion: { increment: 1 } },
  });
  return { success: true };
}

export async function updateProfile(userId: string, { name, color }: { name: string; color: string }): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { name, color, initials: initialsFor(name) } });
}
