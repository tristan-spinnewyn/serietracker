import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Poster } from '@/components/ui/poster';
import { Icon } from '@/components/ui/icon';
import { posterUrl } from '@/lib/constants';
import type { WatchStatus } from '@prisma/client';

const STATUS_TABS = [
  { key: null,             label: 'Tout' },
  { key: 'WATCHING',       label: 'En cours' },
  { key: 'PLAN_TO_WATCH',  label: 'À regarder' },
  { key: 'COMPLETED',      label: 'Terminés' },
  { key: 'PAUSED',         label: 'En pause' },
  { key: 'DROPPED',        label: 'Abandonnés' },
] as const;

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string }> }) {
  const session = await auth();
  const userId = session!.user.id;
  const { status, type } = await searchParams;

  const validStatus = STATUS_TABS.some(t => t.key === status) ? (status as WatchStatus) : undefined;
  const validType = type === 'ANIME' || type === 'SERIES' ? type : undefined;

  const userShows = await db.userShow.findMany({
    where: {
      userId,
      ...(validStatus ? { status: validStatus } : {}),
      ...(validType ? { show: { type: validType } } : {}),
    },
    include: {
      show: {
        include: {
          seasons: { select: { _count: { select: { episodes: true } } } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const watchedEps = await db.userEpisode.findMany({
    where: { userId },
    select: { episodeId: true },
  });
  const watchedSet = new Set(watchedEps.map(e => e.episodeId));

  const allUserShows = validStatus || validType
    ? await db.userShow.findMany({
        where: { userId },
        include: { show: { select: { type: true } } },
      })
    : userShows;

  const counts = {
    total: allUserShows.length,
    WATCHING: allUserShows.filter(us => us.status === 'WATCHING').length,
    PLAN_TO_WATCH: allUserShows.filter(us => us.status === 'PLAN_TO_WATCH').length,
    COMPLETED: allUserShows.filter(us => us.status === 'COMPLETED').length,
    PAUSED: allUserShows.filter(us => us.status === 'PAUSED').length,
    DROPPED: allUserShows.filter(us => us.status === 'DROPPED').length,
    ANIME: allUserShows.filter(us => us.show.type === 'ANIME').length,
    SERIES: allUserShows.filter(us => us.show.type === 'SERIES').length,
  };

  const rows = userShows.map(us => {
    const totalEps = us.show.seasons.reduce((a, s) => a + s._count.episodes, 0);
    const showEpIds = new Set<string>();
    return { userShow: us, show: us.show, totalEps, showEpIds };
  });

  const showIds = rows.map(r => r.show.id);
  const episodesByShow = await db.episode.findMany({
    where: { season: { showId: { in: showIds } } },
    select: { id: true, season: { select: { showId: true } } },
  });

  const epsByShowId = new Map<string, string[]>();
  for (const ep of episodesByShow) {
    const arr = epsByShowId.get(ep.season.showId) ?? [];
    arr.push(ep.id);
    epsByShowId.set(ep.season.showId, arr);
  }

  const cards = rows.map(r => {
    const epIds = epsByShowId.get(r.show.id) ?? [];
    const watchedCount = epIds.filter(id => watchedSet.has(id)).length;
    return {
      show: r.show,
      status: r.userShow.status,
      rating: r.userShow.rating,
      totalEps: r.totalEps,
      watchedCount,
    };
  });

  function buildHref(params: { status?: string | null; type?: string | null }) {
    const p = new URLSearchParams();
    const s = params.status !== undefined ? params.status : validStatus;
    const t = params.type !== undefined ? params.type : validType;
    if (s) p.set('status', s);
    if (t) p.set('type', t);
    const qs = p.toString();
    return `/library${qs ? `?${qs}` : ''}`;
  }

  const STATUS_LABEL: Record<string, string> = {
    WATCHING: 'En cours', COMPLETED: 'Terminé', PLAN_TO_WATCH: 'À regarder',
    DROPPED: 'Abandonné', PAUSED: 'En pause',
  };

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Bibliothèque</h1>
          <div className="sub">
            {counts.total > 0
              ? <>{counts.total} show{counts.total > 1 ? 's' : ''} dans ta collection</>
              : 'Ta bibliothèque est vide.'}
          </div>
        </div>
        <Link href="/search" className="btn violet">
          <Icon name="plus" size={14} />Ajouter un show
        </Link>
      </div>

      {counts.total > 0 && (
        <>
          {/* Status filter */}
          <div className="filter-chips" style={{ marginBottom: 4 }}>
            {STATUS_TABS.map(tab => {
              const count = tab.key ? counts[tab.key] : counts.total;
              if (tab.key && count === 0) return null;
              const isActive = (tab.key ?? undefined) === validStatus;
              return (
                <Link
                  key={tab.key ?? 'all'}
                  href={buildHref({ status: tab.key })}
                  className={`chip ${isActive ? 'on' : ''}`}
                >
                  {tab.label} <span style={{ opacity: 0.6, marginLeft: 4 }}>{count}</span>
                </Link>
              );
            })}
          </div>

          {/* Type filter */}
          {counts.ANIME > 0 && counts.SERIES > 0 && (
            <div className="filter-chips" style={{ marginBottom: 8 }}>
              <Link href={buildHref({ type: null })} className={`chip ${!validType ? 'on' : ''}`}>
                Tout
              </Link>
              <Link href={buildHref({ type: 'ANIME' })} className={`chip ${validType === 'ANIME' ? 'on' : ''}`}>
                Animes <span style={{ opacity: 0.6, marginLeft: 4 }}>{counts.ANIME}</span>
              </Link>
              <Link href={buildHref({ type: 'SERIES' })} className={`chip ${validType === 'SERIES' ? 'on' : ''}`}>
                Séries <span style={{ opacity: 0.6, marginLeft: 4 }}>{counts.SERIES}</span>
              </Link>
            </div>
          )}
        </>
      )}

      {cards.length > 0 ? (
        <div className="poster-grid" style={{ marginTop: 16 }}>
          {cards.map(({ show, status: st, rating, totalEps, watchedCount }) => {
            const pct = totalEps > 0 ? Math.round((watchedCount / totalEps) * 100) : 0;
            return (
              <Link key={show.id} href={`/show/${show.id}`} style={{ display: 'block', textDecoration: 'none' }}>
                <div style={{ position: 'relative' }}>
                  <Poster title={show.title} type={show.type} imageUrl={posterUrl(show)} />
                  <div style={{
                    position: 'absolute', top: 7, right: 7,
                    padding: '3px 7px', borderRadius: 999,
                    background: 'rgba(10,10,15,0.75)', backdropFilter: 'blur(6px)',
                    fontSize: 10, fontWeight: 600,
                    color: st === 'COMPLETED' ? '#6EE7B7' : st === 'WATCHING' ? '#60A5FA' : st === 'PAUSED' ? '#FBBF24' : 'var(--text-3)',
                    border: `1px solid ${st === 'COMPLETED' ? 'rgba(52,211,153,0.3)' : st === 'WATCHING' ? 'rgba(96,165,250,0.3)' : st === 'PAUSED' ? 'rgba(251,191,36,0.3)' : 'var(--line)'}`,
                  }}>
                    {STATUS_LABEL[st] ?? st}
                  </div>
                  {st === 'WATCHING' && totalEps > 0 && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                      background: 'rgba(0,0,0,0.5)',
                    }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#60A5FA', borderRadius: '0 2px 0 0' }} />
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {show.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {watchedCount}/{totalEps} ép
                    </span>
                    {rating != null && (
                      <span style={{ fontSize: 11, color: '#FBBF24', fontWeight: 600 }}>
                        {'★'.repeat(Math.round(rating))} {rating}/5
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty" style={{ marginTop: 40 }}>
          <Icon name="library" size={28} />
          <h3>Aucun show{validStatus || validType ? ' dans cette catégorie' : ''}</h3>
          <p>Recherche une série ou un anime pour commencer.</p>
          <Link href="/search" className="btn violet"><Icon name="search" size={14} />Chercher des shows</Link>
        </div>
      )}
    </div>
  );
}
