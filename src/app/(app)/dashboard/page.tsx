import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NowCard } from '@/components/shows/now-card';
import { ActivityRow } from '@/components/shows/activity-row';
import { UpcomingRow } from '@/components/shows/upcoming-row';
import { Poster } from '@/components/ui/poster';
import { Icon } from '@/components/ui/icon';
import { posterUrl } from '@/lib/constants';
import type { NowCardData } from '@/components/shows/now-card';
import type { ActivityEntry } from '@/components/shows/activity-row';
import type { UpcomingItem } from '@/components/shows/upcoming-row';
import { JustWatchCredit } from '@/components/ui/justwatch-credit';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [watchingRows, planRows, upcomingEps, recentActivity] = await Promise.all([
    // Shows en cours
    db.userShow.findMany({
      where: { userId, status: 'WATCHING' },
      include: { show: { include: { seasons: { include: { episodes: { select: { id: true, number: true, title: true, airDate: true } } } } } } },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
    // À voir
    db.userShow.findMany({
      where: { userId, status: 'PLAN_TO_WATCH' },
      include: { show: true },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
    // Épisodes à venir cette semaine
    db.episode.findMany({
      where: {
        airDate: { gte: now, lte: weekEnd },
        season: { show: { userShows: { some: { userId, status: 'WATCHING' } } } },
      },
      include: { season: { include: { show: true } } },
      orderBy: { airDate: 'asc' },
      take: 5,
    }),
    // Activité récente de la famille
    db.userEpisode.findMany({
      include: {
        user: true,
        episode: { include: { season: { include: { show: true } } } },
      },
      orderBy: { watchedAt: 'desc' },
      take: 7,
    }),
  ]);

  // Épisodes vus par l'user courant (pour calculer next ep)
  const watchedIds = new Set(
    (await db.userEpisode.findMany({ where: { userId }, select: { episodeId: true } })).map(r => r.episodeId)
  );

  const nowCards: NowCardData[] = watchingRows.map(us => {
    const show = us.show;
    const allEps = show.seasons.flatMap(s => s.episodes);
    const nextEpDb = show.seasons
      .sort((a, b) => a.number - b.number)
      .flatMap(s => s.episodes.map(e => ({ id: e.id, seasonNumber: s.number, episodeNumber: e.number, title: e.title, airDate: e.airDate })))
      .find(e => !watchedIds.has(e.id));
    return {
      id: show.id,
      title: show.title,
      type: show.type,
      genre: show.genre,
      posterUrl: posterUrl(show),
      watchedCount: allEps.filter(e => watchedIds.has(e.id)).length,
      totalEps: allEps.length,
      nextEp: nextEpDb ? {
        s: nextEpDb.seasonNumber,
        e: nextEpDb.episodeNumber,
        title: nextEpDb.title ?? `Épisode ${nextEpDb.episodeNumber}`,
        date: nextEpDb.airDate ? new Date(nextEpDb.airDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '',
      } : null,
    };
  });

  const upcomingItems: UpcomingItem[] = upcomingEps.map(ep => {
    const d = ep.airDate!;
    return {
      showId: ep.season.show.id,
      showTitle: ep.season.show.title,
      type: ep.season.show.type,
      day: d.getDate(),
      month: d.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase(),
      ep: `S${ep.season.number} · E${ep.number}`,
      epTitle: ep.title ?? '',
      notify: true,
    };
  });

  const activityEntries: ActivityEntry[] = recentActivity.map(ue => {
    const show = ue.episode.season.show;
    return {
      id: ue.id,
      userName: ue.user.name,
      userColor: ue.user.color,
      userInitials: ue.user.initials,
      verb: 'a vu',
      showTitle: show.title,
      showType: show.type,
      showPosterUrl: posterUrl(show),
      detail: `S${ue.episode.season.number} · E${ue.episode.number}${ue.episode.title ? ` — ${ue.episode.title}` : ''}`,
      when: timeAgo(ue.watchedAt),
    };
  });

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
          {upcomingItems.length > 0 && (
            <>
              <div className="section-h">
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

      {planRows.length > 0 && (
        <>
          <div className="section-h">
            <h2>À voir <span className="count">· {planRows.length}</span></h2>
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

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}
