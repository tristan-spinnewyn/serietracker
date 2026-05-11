'use server';

import { hash } from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';

const schema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function registerAction(data: { name: string; email: string; password: string }) {
  // Block if registration closed
  if (process.env.ALLOW_REGISTRATION !== 'true') {
    const allowed = (process.env.ALLOWED_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase());
    if (!allowed.includes(data.email.toLowerCase())) {
      return { error: 'Inscriptions fermées. Demande une invitation.' };
    }
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { error: 'Données invalides.' };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'Un compte existe déjà avec cet email.' };
  }

  const passwordHash = await hash(password, 12);
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const COLORS = ['#A855F7', '#FB7185', '#34D399', '#FBBF24', '#60A5FA'];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];

  await db.user.create({
    data: { name, email, passwordHash, initials, color },
  });

  return { success: true };
}
