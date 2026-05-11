import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SeriesTracker · famille',
  description: 'Suivi privé de séries TV et animes pour un usage familial.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable} style={{ height: '100%' }}>
      <body style={{ height: '100%' }}>
        {children}
      </body>
    </html>
  );
}
