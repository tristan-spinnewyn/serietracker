import { db } from '@/lib/db';

const DEFAULT_COLOR = '#A855F7';

/** Data shown around every signed-in page: the sidebar's lists, user card and unread badge. */
export async function getAppShell(user: { id: string; name: string }) {
  const [lists, watchingCount, dbUser, unreadCount] = await Promise.all([
    db.sharedList.findMany({
      where: { members: { some: { userId: user.id } } },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    db.userShow.count({ where: { userId: user.id, status: 'WATCHING' } }),
    db.user.findUnique({ where: { id: user.id }, select: { color: true, initials: true } }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return {
    lists: lists.map(l => ({
      id: l.id,
      name: l.name,
      emoji: l.emoji,
      color: l.color,
      itemCount: l._count.items,
      mine: l.createdById === user.id,
    })),
    user: {
      name: user.name,
      color: dbUser?.color ?? DEFAULT_COLOR,
      initials: dbUser?.initials ?? user.name.slice(0, 2).toUpperCase(),
      watchingCount,
    },
    unreadCount,
  };
}
