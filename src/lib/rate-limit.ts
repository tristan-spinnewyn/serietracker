// In-memory fixed-window rate limiter. The app runs as a single instance, so
// process memory is enough; counters reset on restart. A multi-instance
// deployment would need a shared store (Postgres or Redis) behind the same API.

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

interface Window {
  count: number;
  resetAt: number;
}

const PRUNE_THRESHOLD = 1000;
const windows = new Map<string, Window>();

function pruneExpired(now: number) {
  for (const [key, w] of windows) {
    if (w.resetAt <= now) windows.delete(key);
  }
}

/** Records one call for `key` and tells whether it is within `rule`. */
export function consumeRateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  if (windows.size >= PRUNE_THRESHOLD) pruneExpired(now);

  let w = windows.get(key);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + rule.windowMs };
    windows.set(key, w);
  }

  w.count++;
  return { allowed: w.count <= rule.limit, retryAfterMs: w.resetAt - now };
}

/** Test helper: forgets every counter. */
export function resetRateLimits() {
  windows.clear();
}

/**
 * Client IP as seen by the reverse proxy (Traefik on Coolify sets X-Real-IP).
 * The last X-Forwarded-For hop is the one the proxy appended; earlier hops
 * are client-controlled and cannot be trusted.
 */
export function getClientIp(headers: Headers): string {
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const lastHop = headers.get('x-forwarded-for')?.split(',').pop()?.trim();
  return lastHop || 'unknown';
}

export const RATE_LIMITS = {
  loginPerEmail:      { limit: 10, windowMs: 15 * 60_000 },
  loginPerIp:         { limit: 30, windowMs: 15 * 60_000 },
  registerPerIp:      { limit: 5,  windowMs: 60 * 60_000 },
  importPerUser:      { limit: 30, windowMs: 60_000 },
  resyncPerUser:      { limit: 10, windowMs: 60_000 },
  anilistSyncPerUser: { limit: 3,  windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitRule>;
