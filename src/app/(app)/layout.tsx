import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getAppShell } from '@/lib/services/app-shell';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const shell = await getAppShell(session.user);

  return (
    <div className="app">
      <Sidebar lists={shell.lists} user={shell.user} unreadCount={shell.unreadCount} />
      <main className="main">
        <Topbar />
        {children}
      </main>
    </div>
  );
}
