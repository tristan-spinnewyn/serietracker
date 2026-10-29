import { describe, it, expect } from 'vitest';
import { getSafeCallbackUrl } from '@/lib/safe-redirect';

describe('getSafeCallbackUrl', () => {
  it('returns the fallback when no callback URL is given', () => {
    expect(getSafeCallbackUrl(null)).toBe('/dashboard');
    expect(getSafeCallbackUrl('')).toBe('/dashboard');
  });

  it('uses a custom fallback when provided', () => {
    expect(getSafeCallbackUrl(null, '/library')).toBe('/library');
  });

  it('keeps a same-origin relative path with its query and hash', () => {
    expect(getSafeCallbackUrl('/show/abc?tab=episodes#s2')).toBe('/show/abc?tab=episodes#s2');
  });

  it.each([
    ['absolute URL', 'https://evil.com/phish'],
    ['protocol-relative URL', '//evil.com'],
    ['backslash trick', '/\\evil.com'],
    ['tab-separated slashes', '/\t/evil.com'],
    ['newline-separated slashes', '/\n/evil.com'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['path without leading slash', 'evil.com'],
  ])('rejects an external redirect (%s)', (_label, raw) => {
    expect(getSafeCallbackUrl(raw)).toBe('/dashboard');
  });
});
