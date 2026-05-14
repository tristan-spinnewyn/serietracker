import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Poster } from '@/components/ui/poster';
import { Icon } from '@/components/ui/icon';
import { posterUrl } from '@/lib/constants';

export default async function TerminePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const session = await auth();
  const userId = session!.user.id;
  const { type } = await searchParams;

  const whereType = type === 'ANIME' ? 'ANIME' : type === 'SERIES' ? 'SERIES' : undefined;

  const completed = await db.userShow.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      ...(whereType ? { show: { type: whereType } } : {}),
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

  const rows = completed.map(us => {
    const totalEps = us.show.seasons.reduce((a, s) => a + s._count.episodes, 0);
    const hours = Math.round(totalEps * (us.show.runtime ?? 24) / 60);
    return { show: us.show, totalEps, hours, rating: us.rating };
  });

  const totalHours = rows.reduce((a, r) => a + r.hours, 0);
  const totalEps   = rows.reduce((a, r) => a + r.totalEps, 0);

  const animeCount  = completed.filter(us => us.show.type === 'ANIME').length;
  const seriesCount = completed.filter(us => us.show.type === 'SERIES').length;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Terminé</h1>
          <div className="sub">
            {completed.length > 0
              ? <>{completed.length} œuvre{completed.length > 1 ? 's' : ''} · {totalEps.toLocaleString('fr-FR')} épisodes · ~{totalHours}h regardées</>
              : 'Aucun show terminé pour l\'instant.'}
          </div>
        </div>
      </div>

      {/* Filtres */}
      {(animeCount > 0 && seriesCount > 0) && (
        <div className="filter-chips" style={{ marginBottom: 8 }}>
          <Link href="/termine" className={`chip ${!type ? 'on' : ''}`}>
            Tout <span style={{ opacity: 0.6, marginLeft: 4 }}>{completed.length + (whereType ? (whereType === 'ANIME' ? seriesCount : animeCount) : 0)}</span>
          </Link>
          <Link href="/termine?type=ANIME" className={`chip ${type === 'ANIME' ? 'on' : ''}`}>
            Animes <span style={{ opacity: 0.6, marginLeft: 4 }}>{animeCount}</span>
          </Link>
          <Link href="/termine?type=SERIES" className={`chip ${type === 'SERIES' ? 'on' : ''}`}>
            Séries <span style={{ opacity: 0.6, marginLeft: 4 }}>{seriesCount}</span>
          </Link>
        </div>
      )}

      {rows.length > 0 ? (
        <div className="poster-grid">
          {rows.map(({ show, totalEps, hours, rating }) => (
            <Link key={show.id} href={`/show/${show.id}`} style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{ position: 'relative' }}>
                <Poster title={show.title} type={show.type} imageUrl={posterUrl(show)} />
                <div style={{
                  position: 'absolute', top: 7, right: 7,
                  padding: '3px 7px', borderRadius: 999,
                  background: 'rgba(10,10,15,0.75)', backdropFilter: 'blur(6px)',
                  fontSize: 10, fontWeight: 600, color: '#6EE7B7',
                  border: '1px solid rgba(52,211,153,0.3)',
                }}>✓</div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {show.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {totalEps} ép · ~{hours}h
                  </span>
                  {rating != null && (
                    <span style={{ fontSize: 11, color: '#FBBF24', fontWeight: 600 }}>
                      {'★'.repeat(Math.round(rating))}
                      <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> {rating}/5</span>
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ marginTop: 40 }}>
          <Icon name="check" size={28} />
          <h3>Aucun show terminé{type ? ` dans cette catégorie` : ''}</h3>
          <p>Marque des shows comme terminés depuis leur fiche.</p>
          <Link href="/search" className="btn violet"><Icon name="search" size={14} />Chercher des shows</Link>
        </div>
      )}
    </div>
  );
}
