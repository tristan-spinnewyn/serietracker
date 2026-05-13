import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Poster } from '@/components/ui/poster';
import { Icon } from '@/components/ui/icon';
import { posterUrl } from '@/lib/constants';
import { JustWatchCredit } from '@/components/ui/justwatch-credit';

export default async function BingePage() {
  const session = await auth();
  const userId = session!.user.id;

  // Shows avec WATCHING/PAUSED que l'user n'a pas terminés
  const watchingShows = await db.userShow.findMany({
    where: { userId, status: { in: ['WATCHING', 'PAUSED'] } },
    include: {
      show: {
        include: {
          seasons: { include: { episodes: { select: { id: true, airDate: true } } } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const watchedIds = new Set(
    (await db.userEpisode.findMany({ where: { userId }, select: { episodeId: true } })).map(r => r.episodeId)
  );

  // Shows terminés (ENDED) pas encore dans la liste de l'user — pour "Découvrir"
  const endedShows = await db.show.findMany({
    where: {
      status: 'ENDED',
      userShows: { none: { userId } },
    },
    include: { seasons: { include: { episodes: { select: { id: true } } } } },
    orderBy: { lastSyncedAt: 'desc' },
    take: 6,
  });

  const catchup = watchingShows
    .map(us => {
      const show = us.show;
      const allEps = show.seasons.flatMap(s => s.episodes);
      const watched = allEps.filter(e => watchedIds.has(e.id)).length;
      const remaining = allEps.length - watched;
      const runtime = show.runtime ?? 45;
      return { show, watched, total: allEps.length, remaining, remainingHours: Math.round(remaining * runtime / 60 * 10) / 10 };
    })
    .filter(r => r.remaining > 0);

  const discover = endedShows.map(show => {
    const total = show.seasons.reduce((a, s) => a + s.episodes.length, 0);
    const runtime = show.runtime ?? 45;
    return { show, total, remainingHours: Math.round(total * runtime / 60 * 10) / 10 };
  });

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Diffusion terminée</h1>
          <div className="sub">Shows à rattraper ou à découvrir d&apos;une traite.</div>
        </div>
      </div>

      {catchup.length > 0 && (
        <>
          <div className="section-h">
            <h2>À rattraper <span className="count">· {catchup.length}</span></h2>
          </div>
          <div className="now-row">
            {catchup.map(({ show, watched, total, remainingHours }) => (
              <Link key={show.id} href={`/show/${show.id}`} className={`now-card ${show.type === 'ANIME' ? 'anime' : 'series'}`} style={{ textDecoration: 'none', display: 'block' }}>
                <Poster title={show.title} type={show.type} imageUrl={posterUrl(show)} />
                <div className="t" style={{ marginTop: 12 }}>{show.title}</div>
                <div className="sub">{show.genre ?? show.network ?? '—'}</div>
                <div className="progress" style={{ marginTop: 10 }}>
                  <div className="progress-bar"><i style={{ width: `${total > 0 ? Math.round(watched / total * 100) : 0}%` }} /></div>
                  <span>{watched}/{total}</span>
                </div>
                <div className="next" style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {total - watched} ép · ~{remainingHours}h restantes
                  </span>
                  <div className="play" style={{ background: 'var(--green)' }}><Icon name="play" size={10} /></div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {discover.length > 0 && (
        <>
          <div className="section-h" style={{ marginTop: 36 }}>
            <h2>Découvrir <span className="count">· saisons complètes</span></h2>
          </div>
          <div className="now-row">
            {discover.map(({ show, total, remainingHours }) => (
              <Link key={show.id} href={`/show/${show.id}`} className={`now-card ${show.type === 'ANIME' ? 'anime' : 'series'}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ position: 'relative' }}>
                  <Poster title={show.title} type={show.type} imageUrl={posterUrl(show)} />
                  <div style={{ position: 'absolute', top: 8, right: 8, padding: '3px 8px', borderRadius: 999, background: 'rgba(10,10,15,0.7)', backdropFilter: 'blur(6px)', fontSize: 10.5, fontWeight: 600, color: '#6EE7B7', border: '1px solid rgba(52,211,153,0.3)' }}>
                    ● TERMINÉE
                  </div>
                </div>
                <div className="t" style={{ marginTop: 12 }}>{show.title}</div>
                <div className="sub">{show.genre ?? '—'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace', marginTop: 8 }}>
                  {total} ép · ~{remainingHours}h
                </div>
                <div className="next">
                  <span style={{ fontSize: 11, color: 'var(--green)' }}>Prêt à enchaîner</span>
                  <div className="play" style={{ background: 'var(--green)' }}><Icon name="play" size={10} /></div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {catchup.length === 0 && discover.length === 0 && (
        <div className="empty" style={{ marginTop: 40 }}>
          <Icon name="binge" size={28} />
          <h3>Rien à enchaîner pour l&apos;instant</h3>
          <p>Ajoute des shows depuis la recherche ou termine ceux en cours.</p>
          <Link href="/search" className="btn violet"><Icon name="search" size={14} />Chercher des shows</Link>
        </div>
      )}

      <div style={{ marginTop: 40, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
        <JustWatchCredit />
      </div>
    </div>
  );
}
