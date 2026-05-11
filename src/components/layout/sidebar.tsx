'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Icon } from '@/components/ui/icon';

type NavIcon = 'home' | 'calendar' | 'binge' | 'search' | 'lists' | 'bell' | 'star';

const NAV_ITEMS: { id: string; href: string; label: string; icon: NavIcon; badgeNew?: boolean; badge?: number }[] = [
  { id: 'home',          href: '/dashboard',     label: 'Accueil',       icon: 'home' },
  { id: 'calendar',      href: '/calendar',      label: 'Calendrier',    icon: 'calendar' },
  { id: 'sorties',       href: '/sorties',       label: 'Sorties',       icon: 'star' },
  { id: 'binge',         href: '/binge',         label: 'Diffusion terminée', icon: 'binge' },
  { id: 'search',        href: '/search',        label: 'Rechercher',    icon: 'search' },
  { id: 'lists',         href: '/lists',         label: 'Listes',        icon: 'lists' },
  { id: 'notifications', href: '/notifications', label: 'Notifications', icon: 'bell', badge: 3 },
];

export interface SidebarList {
  id: string;
  name: string;
  emoji: string;
  color: string;
  itemCount: number;
  mine: boolean;
}

export interface SidebarUser {
  name: string;
  color: string;
  initials: string;
  watchingCount: number;
}

function ListSection({ title, items }: { title: string; items: SidebarList[] }) {
  const router = useRouter();
  if (!items.length) return null;
  return (
    <>
      <div className="nav-sect">{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(l => (
          <button key={l.id} className="list-link" onClick={() => router.push(`/lists?id=${l.id}`)}>
            <div className="list-dot" style={{ background: l.color }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {l.emoji} {l.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
              {l.itemCount}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

export function Sidebar({ lists, user }: { lists: SidebarList[]; user: SidebarUser }) {
  const pathname = usePathname();
  const router = useRouter();

  const myLists     = lists.filter(l => l.mine);
  const sharedLists = lists.filter(l => !l.mine);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" />
        <div className="brand-name">
          SeriesTracker<br />
          <span>· famille</span>
        </div>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.id}
            href={item.href}
            className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
          >
            <Icon name={item.icon} size={16} />
            <span>{item.label}</span>
            {item.badge    && <span className="nav-badge">{item.badge}</span>}
            {item.badgeNew && <span className="nav-badge green">New</span>}
          </Link>
        ))}
      </nav>

      <ListSection title="Mes listes" items={myLists} />
      <ListSection title="Partagées avec moi" items={sharedLists} />

      {/* Nouvelle liste */}
      <div style={{ marginTop: 4, paddingLeft: 2, paddingRight: 2 }}>
        <button
          className="list-link"
          style={{ color: 'var(--text-3)', width: '100%' }}
          onClick={() => router.push('/lists')}
        >
          <div className="list-dot" style={{ background: 'transparent', border: '1px dashed var(--line-2)' }} />
          <span>Nouvelle liste…</span>
        </button>
      </div>

      {/* Profil + déconnexion */}
      <div className="who-am-i">
        <div
          className="avatar"
          style={{
            width: 28, height: 28, borderRadius: '50%', fontSize: 11,
            background: `linear-gradient(135deg, ${user.color}, ${user.color}99)`,
            borderColor: 'transparent', flexShrink: 0,
          }}
        >
          {user.initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="name">{user.name}</div>
          <div className="sub">{user.watchingCount} show{user.watchingCount !== 1 ? 's' : ''} en cours</div>
        </div>
        <a href="/settings" className="icon-btn" title="Paramètres">
          <Icon name="settings" size={15} />
        </a>
        <button
          className="icon-btn"
          title="Se déconnecter"
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{ color: 'var(--text-3)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
