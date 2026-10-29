'use server';

import { headers } from 'next/headers';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { consumeRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { emailSchema } from '@/lib/validation';

const schema = z.object({
  name: z.string().min(1).max(50),
  email: emailSchema,
  password: z.string().min(8),
});

export async function registerAction(data: { name: string; email: string; password: string }) {
  const ip = getClientIp(await headers());
  if (!consumeRateLimit(`register:ip:${ip}`, RATE_LIMITS.registerPerIp).allowed) {
    return { error: 'Trop de tentatives. Réessaie plus tard.' };
  }

  // Block if registration closed (the invitation check uses the raw input so a
  // malformed email is still answered with "closed", not "invalid")
  if (process.env.ALLOW_REGISTRATION !== 'true') {
    const allowed = (process.env.ALLOWED_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase());
    if (!allowed.includes(data.email.trim().toLowerCase())) {
      return { error: 'Inscriptions fermées. Demande une invitation.' };
    }
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { error: 'Données invalides.' };
  }

  // Normalized by emailSchema, so a case variant finds the existing account
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
