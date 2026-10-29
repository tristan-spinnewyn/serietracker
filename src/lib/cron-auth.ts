import { createHash, timingSafeEqual } from 'node:crypto';

// Hashing both sides gives equal-length buffers, so timingSafeEqual never
// throws and the comparison time does not leak the secret's length.
function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/**
 * Checks the `Authorization: Bearer <CRON_SECRET>` header of a cron request.
 * Always fails when CRON_SECRET is not configured.
 */
export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get('authorization') ?? '';
  return timingSafeEqual(sha256(header), sha256(`Bearer ${secret}`));
}
