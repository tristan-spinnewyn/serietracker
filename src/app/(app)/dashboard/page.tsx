import Link from 'next/link';
import { auth } from '@/lib/auth';
import { NowCard } from '@/components/shows/now-card';
import { ActivityRow } from '@/components/shows/activity-row';
import { UpcomingRow } from '@/components/shows/upcoming-row';
import { Poster } from '@/components/ui/poster';
import { Icon } from '@/components/ui/icon';
import { JustWatchCredit } from '@/components/ui/justwatch-credit';
import { getDashboard } from '@/lib/services/dashboard';
import { posterUrl } from '@/lib/constants';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const { nowCards, upcomingItems, activityEntries, planRows } = await getDashboard(userId);

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>{greeting()}, {session!.user.name.split(' ')[0]}.</h1>
          <div className="sub">
            {upcomingItems.length > 0
              ? <><strong style={{ color: 'var(--text)' }}>{upcomingItems.length} épisode{upcomingItems.length > 1 ? 's' : ''}</strong> cette semaine</>
              : 'Aucun épisode prévu cette semaine.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/search" className="btn violet">
            <Icon name="plus" size={14} />Ajouter un show
          </Link>
        </div>
      </div>

      {nowCards.length > 0 && (
        <>
          <div className="section-h">
            <h2>Continuer à regarder <span className="count">· {nowCards.length}</span></h2>
            <Link href="/search" className="see-all">Tout voir <Icon name="chevR" size={14} /></Link>
          </div>
          <div className="now-row">
            {nowCards.map(s => <NowCard key={s.id} show={s} />)}
          </div>
        </>
      )}

      <div className="two-col" style={{ marginTop: 16 }}>
        <div>
          {planRows.length > 0 && (
            <>
              <div className="section-h">
                <h2>À regarder <span className="count">· {planRows.length}</span></h2>
                <Link href="/lists" className="see-all">Mes listes <Icon name="chevR" size={14} /></Link>
              </div>
              <div className="poster-grid">
                {planRows.map(us => (
                  <Link key={us.show.id} href={`/show/${us.show.id}`} style={{ display: 'block' }}>
                    <Poster title={us.show.title} type={us.show.type} imageUrl={posterUrl(us.show)} />
                  </Link>
                ))}
              </div>
            </>
          )}
          {upcomingItems.length > 0 && (
            <>
              <div className="section-h" style={{ marginTop: planRows.length > 0 ? 24 : 0 }}>
                <h2>À venir cette semaine <span className="count">· {upcomingItems.length}</span></h2>
                <Link href="/calendar" className="see-all">Calendrier <Icon name="chevR" size={14} /></Link>
              </div>
              <div className="upcoming">
                {upcomingItems.map((u, i) => <UpcomingRow key={i} item={u} />)}
              </div>
            </>
          )}
        </div>
        <div>
          {activityEntries.length > 0 && (
            <>
              <div className="section-h">
                <h2>Activité de la famille</h2>
              </div>
              <div className="activity">
                {activityEntries.map(a => <ActivityRow key={a.id} entry={a} />)}
              </div>
            </>
          )}
        </div>
      </div>

      {nowCards.length === 0 && planRows.length === 0 && (
        <div className="empty" style={{ marginTop: 40 }}>
          <Icon name="search" size={28} />
          <h3>Ta bibliothèque est vide</h3>
          <p>Recherche une série ou un anime pour commencer.</p>
          <Link href="/search" className="btn violet"><Icon name="plus" size={14} />Ajouter un show</Link>
        </div>
      )}

      <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--text-3)', display: 'flex', justifyContent: 'space-between' }}>
        <span>SeriesTracker · usage privé familial</span>
        <JustWatchCredit />
      </div>
    </div>
  );
}
