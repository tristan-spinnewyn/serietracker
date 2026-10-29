import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';

function requestWith(authorization?: string) {
  const headers = authorization === undefined ? undefined : { authorization };
  return new Request('http://localhost/api/cron/sync-shows', { method: 'POST', headers });
}

describe('isAuthorizedCronRequest', () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'super-secret';
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it('accepts the configured bearer token', () => {
    expect(isAuthorizedCronRequest(requestWith('Bearer super-secret'))).toBe(true);
  });

  it.each([
    ['missing header', undefined],
    ['wrong token', 'Bearer bad-secret'],
    ['token with a different length', 'Bearer super-secret-but-longer'],
    ['missing Bearer prefix', 'super-secret'],
  ])('rejects a request with a %s', (_label, authorization) => {
    expect(isAuthorizedCronRequest(requestWith(authorization))).toBe(false);
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
  ])('rejects every request when CRON_SECRET is %s', (_label, secret) => {
    if (secret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = secret;

    expect(isAuthorizedCronRequest(requestWith('Bearer undefined'))).toBe(false);
    expect(isAuthorizedCronRequest(requestWith('Bearer '))).toBe(false);
  });
});
