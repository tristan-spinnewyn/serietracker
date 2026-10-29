// Posters and banners are rendered with plain <img> tags pointing at these CDNs
const IMAGE_HOSTS = ['https://image.tmdb.org', 'https://s4.anilist.co'];

function buildCsp(isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    // No nonces: Next.js inline bootstrap scripts need 'unsafe-inline'; React refresh needs eval in dev
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    // globals.css imports Inter and JetBrains Mono from Google Fonts
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' blob: data: ${IMAGE_HOSTS.join(' ')}`,
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ];
  return directives.join('; ');
}

export function buildSecurityHeaders(isDev: boolean): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: buildCsp(isDev) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // No includeSubDomains: other services may live on sibling subdomains
    { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ];
}
