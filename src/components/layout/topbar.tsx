'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';

const LABELS: Record<string, string> = {
  '/dashboard':     'Accueil',
  '/calendar':      'Calendrier',
  '/search':        'Rechercher',
  '/lists':         'Listes',
  '/binge':         'Binge-ready',
  '/notifications': 'Notifications',
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isShow = pathname.startsWith('/show/');
  const label = LABELS[pathname] ?? (isShow ? null : 'SeriesTracker');

  return (
    <div className="topbar">
      <div className="crumbs">
        {isShow ? (
          <>
            <button onClick={() => router.push('/dashboard')} style={{ color: 'var(--text-2)' }}>
              Accueil
            </button>
            <span style={{ margin: '0 8px', color: 'var(--text-3)' }}>/</span>
            <strong>Fiche détaillée</strong>
          </>
        ) : (
          <strong>{label}</strong>
        )}
      </div>

      <button className="search-mini" onClick={() => router.push('/search')}>
        <Icon name="search" size={14} />
        <span>Rechercher un show…</span>
        <kbd>⌘ K</kbd>
      </button>

      <a href="/notifications" className="icon-btn">
        <Icon name="bell" size={18} />
      </a>
      <a href="/settings" className="icon-btn">
        <Icon name="settings" size={18} />
      </a>
    </div>
  );
}
