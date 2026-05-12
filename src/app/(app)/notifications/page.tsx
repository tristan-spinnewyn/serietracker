import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Icon } from '@/components/ui/icon';
import { MarkReadOnMount } from './mark-read';
import type { NotifType } from '@prisma/client';

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `il y a ${Math.floor(diff / 86400)} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const TYPE_LABEL: Record<NotifType, string> = {
  NEW_EPISODE:     'Nouvel épisode',
  NEW_SEASON:      'Nouvelle saison',
  SHOW_RETURNING:  'Retour de série',
  EPISODE_TOMORROW:'Demain',
  SEASON_COMPLETE: 'Saison terminée',
};

export default async function NotificationsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const hasUnread = notifications.some(n => !n.read);

  if (notifications.length === 0) {
    return (
      <div className="page">
        <div className="page-h">
          <div>
            <h1>Notifications</h1>
            <div className="sub">Les épisodes du jour arrivent en push à 8h</div>
          </div>
        </div>
        <div className="empty">
          <Icon name="bell" size={28} />
          <h3>Tout est calme pour le moment</h3>
          <p>Les nouvelles saisons et épisodes apparaîtront ici.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <MarkReadOnMount hasUnread={hasUnread} />
      <div className="page-h">
        <div>
          <h1>Notifications</h1>
          <div className="sub">{notifications.length} notification{notifications.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {notifications.map(n => {
          const isUnread = !n.read;
          const inner = (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 10,
                background: isUnread ? 'var(--bg-2)' : 'transparent',
                border: '1px solid',
                borderColor: isUnread ? 'var(--line-2)' : 'transparent',
                transition: 'background 0.15s',
                cursor: n.showId ? 'pointer' : 'default',
              }}
            >
              <div
                style={{
                  width: 3,
                  alignSelf: 'stretch',
                  borderRadius: 2,
                  background: isUnread ? 'var(--violet)' : 'transparent',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {TYPE_LABEL[n.type]}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>·</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{timeAgo(n.createdAt)}</span>
                </div>
                <div style={{ fontWeight: isUnread ? 600 : 400, color: 'var(--text)', fontSize: 13.5 }}>
                  {n.title}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>
                  {n.body}
                </div>
              </div>
              {isUnread && (
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--violet)', flexShrink: 0, marginTop: 5 }} />
              )}
            </div>
          );

          return n.showId ? (
            <Link key={n.id} href={`/show/${n.showId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              {inner}
            </Link>
          ) : (
            <div key={n.id}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
