'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { apiFetch } from '@/lib/fetch';
import { upsertUserShow } from '@/lib/actions/shows';
import type { ReleaseItem } from '@/app/api/releases/route';

type Filter = 'all' | 'movies' | 'series' | 'anime';

const TYPE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  MOVIE:  { bg: 'rgba(14,165,233,0.25)',  color: '#BAE6FD',  label: 'Film' },
  SERIES: { bg: 'rgba(168,85,247,0.25)',  color: '#E9D5FF',  label: 'Série' },
  ANIME:  { bg: 'rgba(251,113,133,0.25)', color: '#FECDD3',  label: 'Anime' },
};

function scoreColor(s: number) {
  if (s >= 8) return '#34D399';
  if (s >= 6) return '#FBBF24';
  return '#FB7185';
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatNextAiring(iso: string | null, ep: number | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const dayStr = diff <= 0 ? "aujourd'hui" : diff === 1 ? 'demain' : `dans ${diff} j`;
  return `Ep ${ep} · ${dayStr} · ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

function CardInner({ item }: { item: ReleaseItem }) {
  const ts = TYPE_STYLE[item.type];
  const nextAiring = formatNextAiring(item.nextAiringDate, item.nextAiringEpisode);
  const releaseDate = formatDate(item.releaseDate);

  return (
    <>
      {/* Poster */}
      <div style={{ position: 'relative', aspectRatio: '2/3', overflow: 'hidden', background: 'var(--bg-2)' }}>
        {item.posterUrl
          ? <img src={item.posterUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(150deg, #1E1B4B, #6366F1)' }} />
        }
        <div style={{ position: 'absolute', top: 8, left: 8, padding: '2px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', backdropFilter: 'blur(6px)', background: ts.bg, color: ts.color }}>
          {ts.label}
        </div>
        {item.score !== null && (
          <div style={{ position: 'absolute', top: 8, right: 8, padding: '2px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700, backdropFilter: 'blur(6px)', background: 'rgba(10,10,15,0.75)', color: scoreColor(item.score), fontFamily: 'JetBrains Mono, monospace' }}>
            ★ {item.score.toFixed(1)}
          </div>
        )}
        {item.localId && (
          <div style={{ position: 'absolute', top: 8, right: 8, padding: '2px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 600, backdropFilter: 'blur(6px)', background: 'rgba(10,10,15,0.75)', color: '#6EE7B7', border: '1px solid rgba(52,211,153,0.3)' }}>
            ✓ En liste
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(0deg, rgba(10,10,15,0.95) 0%, transparent 100%)', padding: '20px 10px 8px' }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: ['En salles', "Aujourd'hui", 'En cours'].includes(item.status) ? '#6EE7B7' : '#FBBF24' }}>
            ● {item.status}
          </div>
        </div>
      </div>
      {/* Infos */}
      <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontWeight: 600, fontSize: 13, letterSpacing: '-0.01em', lineHeight: 1.25 }}>{item.title}</div>
        {item.genre && <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{item.genre}</div>}
        {nextAiring ? (
          <div style={{ fontSize: 11, color: 'var(--anime)', fontWeight: 500 }}>{nextAiring}</div>
        ) : releaseDate ? (
          <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{releaseDate}</div>
        ) : null}
        {item.type === 'ANIME' && item.totalEpisodes && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>{item.totalEpisodes} ép.</div>
        )}
        {item.network && item.type === 'SERIES' && (
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.network}</div>
        )}
      </div>
    </>
  );
}

function AddToListButton({ localId }: { localId: string }) {
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (done) return;
    startTransition(async () => {
      await upsertUserShow({ showId: localId, status: 'PLAN_TO_WATCH' });
      setDone(true);
    });
  };

  return (
    <div style={{ padding: '0 12px 12px' }}>
      <button
        onClick={handleClick}
        disabled={isPending || done}
        className="btn"
        style={{ width: '100%', justifyContent: 'center', fontSize: 12, paddingTop: 6, paddingBottom: 6, opacity: isPending ? 0.6 : 1 }}
      >
        {done ? <><Icon name="check" size={12} /> Ajouté</> : isPending ? 'Ajout…' : <><Icon name="plus" size={12} /> À regarder</>}
      </button>
    </div>
  );
}

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 14,
  overflow: 'hidden', display: 'flex', flexDirection: 'column',
  transition: 'border-color .15s, transform .2s', textDecoration: 'none', cursor: 'pointer',
};

function ReleaseCard({ item, onImport }: { item: ReleaseItem; onImport: (item: ReleaseItem) => void }) {
  const [importing, setImporting] = useState(false);
  const canTrack = (item.type === 'ANIME' && item.anilistId) || (item.type === 'SERIES' && item.tmdbId);

  const onHover = (on: boolean) => (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.borderColor = on ? 'var(--line-2)' : 'var(--line)';
    (e.currentTarget as HTMLElement).style.transform = on ? 'translateY(-2px)' : 'none';
  };

  // Déjà en base → carte cliquable vers la fiche
  if (item.localId) {
    const localId = item.localId;
    return (
      <Link href={`/show/${localId}`} style={CARD_STYLE} onMouseEnter={onHover(true)} onMouseLeave={onHover(false)}>
        <CardInner item={item} />
        {!item.userHasShow && (
          <AddToListButton localId={localId} />
        )}
      </Link>
    );
  }

  // Pas encore en base → bouton import
  return (
    <div style={CARD_STYLE} onMouseEnter={onHover(true)} onMouseLeave={onHover(false)}>
      <CardInner item={item} />
      {canTrack && (
        <div style={{ padding: '0 12px 12px' }}>
          <button
            onClick={() => { setImporting(true); onImport(item); }}
            disabled={importing}
            className="btn"
            style={{ width: '100%', justifyContent: 'center', fontSize: 12, paddingTop: 6, paddingBottom: 6, opacity: importing ? 0.6 : 1 }}
          >
            {importing ? 'Import…' : <><Icon name="plus" size={12} /> Suivre</>}
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, items, onImport }: { title: string; items: ReleaseItem[]; onImport: (i: ReleaseItem) => void }) {
  if (!items.length) return null;
  return (
    <>
      <div className="section-h">
        <h2>{title} <span className="count">· {items.length}</span></h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 16 }}>
        {items.map(item => <ReleaseCard key={item.id} item={item} onImport={onImport} />)}
      </div>
    </>
  );
}

export default function SortiesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [movies, setMovies] = useState<ReleaseItem[]>([]);
  const [series, setSeries] = useState<ReleaseItem[]>([]);
  const [anime, setAnime] = useState<ReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<{ movies: ReleaseItem[]; series: ReleaseItem[]; anime: ReleaseItem[] }>(`/api/releases?type=${filter}`)
      .then(d => { setMovies(d.movies ?? []); setSeries(d.series ?? []); setAnime(d.anime ?? []); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  const handleImport = useCallback(async (item: ReleaseItem) => {
    try {
      const payload = item.anilistId ? { anilistId: item.anilistId } : { tmdbId: item.tmdbId };
      const d = await apiFetch<{ id: string }>('/api/shows/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      router.push(`/show/${d.id}`);
    } catch (e) { console.error(e); }
  }, [router]);

  const FILTERS: [Filter, string][] = [['all', 'Tout'], ['series', 'Séries'], ['anime', 'Animes'], ['movies', 'Films']];

  const total = movies.length + series.length + anime.length;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Sorties</h1>
          <div className="sub">Séries en cours, animes de la saison, films à l&apos;affiche — mis à jour toutes les heures.</div>
        </div>
      </div>

      <div className="filter-chips" style={{ marginBottom: 4 }}>
        {FILTERS.map(([k, l]) => (
          <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
        {!loading && !error && (
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="sparkle" size={12} /> {total} titre{total > 1 ? 's' : ''}
          </div>
        )}
        {loading && <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 8, alignSelf: 'center' }}>Chargement…</span>}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.2)', color: '#FECACA', fontSize: 13, marginTop: 12 }}>
          Erreur : {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {(filter === 'all' || filter === 'anime') && (
            <>
              <Section
                title="Animes en cours de diffusion"
                items={anime.filter(a => a.status === 'En cours')}
                onImport={handleImport}
              />
              <Section
                title="Animes à venir"
                items={anime.filter(a => a.status === 'À venir')}
                onImport={handleImport}
              />
            </>
          )}
          {(filter === 'all' || filter === 'series') && (
            <Section
              title="Séries en cours"
              items={series}
              onImport={handleImport}
            />
          )}
          {(filter === 'all' || filter === 'movies') && (
            <>
              <Section
                title="Films en salles"
                items={movies.filter(m => m.status === 'En salles')}
                onImport={handleImport}
              />
              <Section
                title="Films à venir"
                items={movies.filter(m => m.status === 'À venir')}
                onImport={handleImport}
              />
            </>
          )}

          {total === 0 && (
            <div className="empty" style={{ marginTop: 40 }}>
              <Icon name="calendar" size={28} />
              <h3>Aucune sortie disponible</h3>
              <p>Vérifie que la clé TMDB est bien renseignée dans <code>.env.local</code>.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
