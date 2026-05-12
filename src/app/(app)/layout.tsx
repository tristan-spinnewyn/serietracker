import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [lists, watchingCount, dbUser, unreadCount] = await Promise.all([
    db.sharedList.findMany({
      where: { members: { some: { userId: session.user.id } } },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    db.userShow.count({ where: { userId: session.user.id, status: 'WATCHING' } }),
    db.user.findUnique({ where: { id: session.user.id }, select: { color: true, initials: true } }),
    db.notification.count({ where: { userId: session.user.id, read: false } }),
  ]);

  return (
    <div className="app">
      <Sidebar
        lists={lists.map(l => ({
          id: l.id,
          name: l.name,
          emoji: l.emoji,
          color: l.color,
          itemCount: l._count.items,
          mine: l.createdById === session.user.id,
        }))}
        user={{
          name: session.user.name,
          color: dbUser?.color ?? '#A855F7',
          initials: dbUser?.initials ?? session.user.name.slice(0, 2).toUpperCase(),
          watchingCount,
        }}
        unreadCount={unreadCount}
      />
      <main className="main">
        <Topbar />
        {children}
      </main>
    </div>
  );
}
