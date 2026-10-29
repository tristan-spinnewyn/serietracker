// Arbitrary origin used only to resolve relative URLs the way a browser would
// (backslashes, tabs and newlines included) before comparing origins.
const PLACEHOLDER_ORIGIN = 'http://placeholder.invalid';

/**
 * Returns `raw` only if it points to a path on this site, otherwise `fallback`.
 * Prevents open redirects through user-controlled `callbackUrl` parameters.
 */
export function getSafeCallbackUrl(raw: string | null, fallback = '/dashboard'): string {
  if (!raw?.startsWith('/')) return fallback;

  const url = new URL(raw, PLACEHOLDER_ORIGIN);
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}
