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

  const [followingRows, followingSeriesRows, watchedEps, discoverShows, discoverSeriesShows] = await Promise.all([
    // Animes suivis (WATCHING / PAUSED) dont la diffusion est terminée
    db.userShow.findMany({
      where: {
        userId,
        status: { in: ['WATCHING', 'PAUSED', 'PLAN_TO_WATCH'] },
        show: { type: 'ANIME', status: { in: ['ENDED', 'CANCELED'] } },
      },
      include: {
        show: {
          include: { seasons: { include: { episodes: { select: { id: true } } } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    // Séries suivies (WATCHING / PAUSED / À regarder) dont la diffusion est terminée
    db.userShow.findMany({
      where: {
        userId,
        status: { in: ['WATCHING', 'PAUSED', 'PLAN_TO_WATCH'] },
        show: { type: 'SERIES', status: { in: ['ENDED', 'CANCELED'] } },
      },
      include: {
        show: {
          include: { seasons: { include: { episodes: { select: { id: true } } } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    // Épisodes vus par l'user
    db.userEpisode.findMany({ where: { userId }, select: { episodeId: true } }),
    // Animes terminés en base pas encore dans la liste de l'user
    db.show.findMany({
      where: {
        type: 'ANIME',
        status: { in: ['ENDED', 'CANCELED'] },
        userShows: { none: { userId } },
      },
      include: { seasons: { select: { _count: { select: { episodes: true } } } } },
      orderBy: { lastSyncedAt: 'desc' },
      take: 12,
    }),
    // Séries terminées en base pas encore dans la liste de l'user
    db.show.findMany({
      where: {
        type: 'SERIES',
        status: { in: ['ENDED', 'CANCELED'] },
        userShows: { none: { userId } },
      },
      include: { seasons: { select: { _count: { select: { episodes: true } } } } },
      orderBy: { lastSyncedAt: 'desc' },
      take: 12,
    }),
  ]);

  const watchedIds = new Set(watchedEps.map(r => r.episodeId));

  const defaultRuntime = (type: string) => type === 'ANIME' ? 24 : 45;

  const mapFollowing = (rows: typeof followingRows) => rows.map(us => {
    const show = us.show;
    const allEps = show.seasons.flatMap(s => s.episodes);
    const total = allEps.length;
    const watched = allEps.filter(e => watchedIds.has(e.id)).length;
    const runtime = show.runtime ?? defaultRuntime(show.type);
    const remainingHours = Math.round((total - watched) * runtime / 60 * 10) / 10;
    return { show, watched, total, remainingHours };
  });

  const mapDiscover = (rows: typeof discoverShows) => rows.map(show => {
    const total = show.seasons.reduce((a, s) => a + s._count.episodes, 0);
    const hours = Math.round(total * (show.runtime ?? defaultRuntime(show.type)) / 60);
    return { show, total, hours };
  });

  const following = mapFollowing(followingRows);
  const followingSeries = mapFollowing(followingSeriesRows);
  const discover = mapDiscover(discoverShows);
  const discoverSeries = mapDiscover(discoverSeriesShows);

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Diffusion terminée</h1>
          <div className="sub">Animes et séries dont la diffusion est terminée — à rattraper ou à découvrir.</div>
        </div>
      </div>

      {/* Animes suivis dont la diffusion est terminée */}
      {following.length > 0 && (
        <>
          <div className="section-h">
            <h2>Mes animes <span className="count">· {following.length}</span></h2>
          </div>
          <div className="now-row">
            {following.map(({ show, watched, total, remainingHours }) => (
              <Link key={show.id} href={`/show/${show.id}`} className="now-card anime" style={{ textDecoration: 'none', display: 'block' }}>
                <Poster title={show.title} type={show.type} imageUrl={posterUrl(show)} />
                <div className="t" style={{ marginTop: 12 }}>{show.title}</div>
                <div className="sub">{show.genre ?? '—'}</div>
                <div className="progress" style={{ marginTop: 10 }}>
                  <div className="progress-bar"><i style={{ width: `${total > 0 ? Math.round(watched / total * 100) : 0}%` }} /></div>
                  <span>{watched}/{total}</span>
                </div>
                <div className="next" style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {total - watched > 0 ? `${total - watched} ép · ~${remainingHours}h restantes` : 'À jour ✓'}
                  </span>
                  <div className="play" style={{ background: 'var(--green)' }}><Icon name="play" size={10} /></div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Séries suivies dont la diffusion est terminée */}
      {followingSeries.length > 0 && (
        <>
          <div className="section-h" style={{ marginTop: following.length > 0 ? 36 : 0 }}>
            <h2>Mes séries <span className="count">· {followingSeries.length}</span></h2>
          </div>
          <div className="now-row">
            {followingSeries.map(({ show, watched, total, remainingHours }) => (
              <Link key={show.id} href={`/show/${show.id}`} className="now-card series" style={{ textDecoration: 'none', display: 'block' }}>
                <Poster title={show.title} type={show.type} imageUrl={posterUrl(show)} />
                <div className="t" style={{ marginTop: 12 }}>{show.title}</div>
                <div className="sub">{show.genre ?? '—'}</div>
                <div className="progress" style={{ marginTop: 10 }}>
                  <div className="progress-bar"><i style={{ width: `${total > 0 ? Math.round(watched / total * 100) : 0}%` }} /></div>
                  <span>{watched}/{total}</span>
                </div>
                <div className="next" style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {total - watched > 0 ? `${total - watched} ép · ~${remainingHours}h restantes` : 'À jour ✓'}
                  </span>
                  <div className="play" style={{ background: 'var(--green)' }}><Icon name="play" size={10} /></div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Animes à découvrir */}
      {discover.length > 0 && (
        <>
          <div className="section-h" style={{ marginTop: (following.length > 0 || followingSeries.length > 0) ? 36 : 0 }}>
            <h2>Animes à découvrir <span className="count">· {discover.length}</span></h2>
          </div>
          <div className="now-row">
            {discover.map(({ show, total, hours }) => (
              <Link key={show.id} href={`/show/${show.id}`} className="now-card anime" style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ position: 'relative' }}>
                  <Poster title={show.title} type={show.type} imageUrl={posterUrl(show)} />
                  <div style={{ position: 'absolute', top: 8, right: 8, padding: '3px 8px', borderRadius: 999, background: 'rgba(10,10,15,0.7)', backdropFilter: 'blur(6px)', fontSize: 10.5, fontWeight: 600, color: '#6EE7B7', border: '1px solid rgba(52,211,153,0.3)' }}>
                    ● TERMINÉ
                  </div>
                </div>
                <div className="t" style={{ marginTop: 12 }}>{show.title}</div>
                <div className="sub">{show.genre ?? '—'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace', marginTop: 8 }}>
                  {total} ép · ~{hours}h
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

      {/* Séries à découvrir */}
      {discoverSeries.length > 0 && (
        <>
          <div className="section-h" style={{ marginTop: (following.length > 0 || followingSeries.length > 0 || discover.length > 0) ? 36 : 0 }}>
            <h2>Séries à découvrir <span className="count">· {discoverSeries.length}</span></h2>
          </div>
          <div className="now-row">
            {discoverSeries.map(({ show, total, hours }) => (
              <Link key={show.id} href={`/show/${show.id}`} className="now-card series" style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ position: 'relative' }}>
                  <Poster title={show.title} type={show.type} imageUrl={posterUrl(show)} />
                  <div style={{ position: 'absolute', top: 8, right: 8, padding: '3px 8px', borderRadius: 999, background: 'rgba(10,10,15,0.7)', backdropFilter: 'blur(6px)', fontSize: 10.5, fontWeight: 600, color: '#6EE7B7', border: '1px solid rgba(52,211,153,0.3)' }}>
                    ● TERMINÉE
                  </div>
                </div>
                <div className="t" style={{ marginTop: 12 }}>{show.title}</div>
                <div className="sub">{show.genre ?? '—'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace', marginTop: 8 }}>
                  {total} ép · ~{hours}h
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

      {following.length === 0 && followingSeries.length === 0 && discover.length === 0 && discoverSeries.length === 0 && (
        <div className="empty" style={{ marginTop: 40 }}>
          <Icon name="binge" size={28} />
          <h3>Rien de terminé pour l&apos;instant</h3>
          <p>Suis des animes ou des séries depuis la recherche pour les retrouver ici.</p>
          <Link href="/search" className="btn violet"><Icon name="search" size={14} />Chercher</Link>
        </div>
      )}

      <div style={{ marginTop: 40, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
        <JustWatchCredit />
      </div>
    </div>
  );
}
