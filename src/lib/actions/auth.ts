'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createAccount } from '@/lib/services/accounts';
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
  return createAccount(parsed.data);
}
