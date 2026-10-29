import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getShowDetail } from '@/lib/services/show-detail';
import { ShowDetail } from './show-detail';

export default async function ShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) notFound();

  const detail = await getShowDetail(id, session.user.id);
  if (!detail) notFound();

  return <ShowDetail {...detail} />;
}
