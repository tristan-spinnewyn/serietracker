import { describe, it, expect } from 'vitest';
import { buildSecurityHeaders } from '@/lib/security-headers';

function headerMap(isDev: boolean) {
  return Object.fromEntries(buildSecurityHeaders(isDev).map(h => [h.key, h.value]));
}

function cspDirectives(isDev: boolean) {
  return Object.fromEntries(
    headerMap(isDev)['Content-Security-Policy']
      .split(';')
      .map(d => d.trim())
      .filter(Boolean)
      .map(d => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values];
      }),
  );
}

describe('buildSecurityHeaders', () => {
  it('sets the baseline hardening headers', () => {
    const headers = headerMap(false);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000');
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('builds a CSP that blocks framing, plugins and foreign form targets', () => {
    const csp = cspDirectives(false);
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['base-uri']).toEqual(["'self'"]);
    expect(csp['form-action']).toEqual(["'self'"]);
  });

  it('allows posters from the TMDB and AniList image CDNs only', () => {
    expect(cspDirectives(false)['img-src']).toEqual([
      "'self'", 'blob:', 'data:', 'https://image.tmdb.org', 'https://s4.anilist.co',
    ]);
  });

  it('allows the Google Fonts stylesheet imported by globals.css and its font files', () => {
    const csp = cspDirectives(false);
    expect(csp['style-src']).toContain('https://fonts.googleapis.com');
    expect(csp['font-src']).toEqual(["'self'", 'https://fonts.gstatic.com']);
  });

  it("only allows 'unsafe-eval' in development", () => {
    expect(cspDirectives(false)['script-src']).not.toContain("'unsafe-eval'");
    expect(cspDirectives(true)['script-src']).toContain("'unsafe-eval'");
  });

  it('only upgrades insecure requests in production', () => {
    expect(cspDirectives(false)).toHaveProperty('upgrade-insecure-requests');
    expect(cspDirectives(true)).not.toHaveProperty('upgrade-insecure-requests');
  });
});
