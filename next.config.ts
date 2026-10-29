import type { NextConfig } from 'next';
import { buildSecurityHeaders } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 's4.anilist.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: buildSecurityHeaders(process.env.NODE_ENV === 'development'),
      },
    ];
  },
};

export default nextConfig;
