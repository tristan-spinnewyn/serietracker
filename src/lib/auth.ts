import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authConfig } from '@/lib/auth.config';
import { emailSchema } from '@/lib/validation';
import { consumeRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
});

class RateLimitedSignin extends CredentialsSignin {
  code = 'rate_limited';
}

function assertLoginAllowed(email: string, request: Request | undefined) {
  const ip = request ? getClientIp(request.headers) : 'unknown';
  const byEmail = consumeRateLimit(`login:email:${email.toLowerCase()}`, RATE_LIMITS.loginPerEmail);
  const byIp = consumeRateLimit(`login:ip:${ip}`, RATE_LIMITS.loginPerIp);
  if (!byEmail.allowed || !byIp.allowed) throw new RateLimitedSignin();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Server-only (needs the DB, unlike the proxy's callbacks in auth.config):
    // a token whose version is behind the user's, or whose user is gone, is revoked.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sessionVersion = user.sessionVersion;
        return token;
      }
      if (!token.id) return token;

      const current = await db.user.findUnique({
        where: { id: token.id },
        select: { sessionVersion: true },
      });
      // Tokens issued before versioning existed carry no version: treat them as 0
      if (!current || current.sessionVersion !== (token.sessionVersion ?? 0)) return null;
      return token;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        assertLoginAllowed(email, request);

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion };
      },
    }),
  ],
});
