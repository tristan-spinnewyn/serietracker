import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { consumeRateLimit, getClientIp, resetRateLimits } from '@/lib/rate-limit';

describe('consumeRateLimit', () => {
  const rule = { limit: 3, windowMs: 60_000 };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    resetRateLimits();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows calls up to the limit, then blocks', () => {
    expect(consumeRateLimit('k', rule).allowed).toBe(true);
    expect(consumeRateLimit('k', rule).allowed).toBe(true);
    expect(consumeRateLimit('k', rule).allowed).toBe(true);

    const blocked = consumeRateLimit('k', rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(60_000);
  });

  it('counts each key separately', () => {
    for (let i = 0; i < 3; i++) consumeRateLimit('a', rule);
    expect(consumeRateLimit('a', rule).allowed).toBe(false);
    expect(consumeRateLimit('b', rule).allowed).toBe(true);
  });

  it('reports the remaining time until the window resets', () => {
    for (let i = 0; i < 3; i++) consumeRateLimit('k', rule);
    vi.advanceTimersByTime(45_000);
    expect(consumeRateLimit('k', rule).retryAfterMs).toBe(15_000);
  });

  it('allows calls again once the window has elapsed', () => {
    for (let i = 0; i < 4; i++) consumeRateLimit('k', rule);
    vi.advanceTimersByTime(60_000);
    expect(consumeRateLimit('k', rule).allowed).toBe(true);
  });

  it('drops expired entries so memory stays bounded', () => {
    for (let i = 0; i < 2000; i++) consumeRateLimit(`k${i}`, rule);
    vi.advanceTimersByTime(60_000);
    consumeRateLimit('fresh', rule);
    // An expired key starts a brand new window
    for (let i = 0; i < 3; i++) expect(consumeRateLimit('k0', rule).allowed).toBe(true);
  });
});

describe('getClientIp', () => {
  it('prefers the X-Real-IP header set by the reverse proxy', () => {
    const headers = new Headers({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.1.1.1, 203.0.113.9' });
    expect(getClientIp(headers)).toBe('203.0.113.7');
  });

  it('falls back to the last X-Forwarded-For hop, the one added by the proxy', () => {
    const headers = new Headers({ 'x-forwarded-for': 'spoofed, 203.0.113.9' });
    expect(getClientIp(headers)).toBe('203.0.113.9');
  });

  it('returns "unknown" when no proxy header is present', () => {
    expect(getClientIp(new Headers())).toBe('unknown');
  });
});
