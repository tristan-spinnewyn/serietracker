'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { Poster } from '@/components/ui/poster';
import { ProviderRow } from '@/components/ui/provider-logo';
import { PALETTES } from '@/lib/constants';
import { apiFetch } from '@/lib/fetch';
import type { Show } from '@prisma/client';
import { JustWatchCredit } from '@/components/ui/justwatch-credit';

// Résultat distant (TMDB ou AniList, pas encore en DB)
interface RemoteResult {
  tmdbId?: number;
  anilistId?: number;
  title: string;
  type: 'SERIES' | 'ANIME';
  year: number | null;
  posterPath: string | null;
  overview: string | null;
}

const TMDB_IMG = 'https://image.tmdb.org/t/p/w300';

function RemoteCard({ result, onImport }: { result: RemoteResult; onImport: (r: RemoteResult) => void }) {
  const [loading, setLoading] = useState(false);
  const imgUrl = result.posterPath
    ? result.tmdbId
      ? `${TMDB_IMG}${result.posterPath}`
      : result.posterPath
    : null;

  return (
    <button
      onClick={() => { setLoading(true); onImport(result); }}
      disabled={loading}
      style={{ display: 'block', background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
    >
      <div className={`poster ${result.type === 'SERIES' ? 'series' : 'anime'}`} style={{ position: 'relative' }}>
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt={result.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className="bg" style={{ background: `linear-gradient(150deg, ${PALETTES[Math.abs(result.title.charCodeAt(0) ?? 0) % PALETTES.length][0]}, ${PALETTES[Math.abs(result.title.charCodeAt(0) ?? 0) % PALETTES.length][1]})` }} />
        )}
        <div className="veil" />
        <div className="type-pill">{result.type === 'SERIES' ? 'Série' : 'Anime'}</div>
        <div className="title">{result.title}</div>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,15,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Import…</span>
          </div>
        )}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <span>{result.year ?? '—'}</span>
        <span style={{ fontSize: 9, color: 'var(--line-2)' }}>·</span>
        <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Ajouter</span>
        <Icon name="plus" size={11} />
      </div>
    </button>
  );
}

function LocalCard({ show }: { show: Show }) {
  const router = useRouter();
  const pal = PALETTES[Math.abs((show.title?.charCodeAt(0) ?? 0)) % PALETTES.length];
  const imgUrl = show.posterPath
    ? show.tmdbId
      ? `${TMDB_IMG}${show.posterPath}`
      : show.posterPath
    : null;

  return (
    <button
      onClick={() => router.push(`/show/${show.id}`)}
      style={{ display: 'block', background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}
    >
      <div className={`poster ${show.type === 'SERIES' ? 'series' : 'anime'}`} style={{ position: 'relative' }}>
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt={show.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className="bg" style={{ background: `linear-gradient(150deg, ${pal[0]}, ${pal[1]})` }} />
        )}
        <div className="grain" />
        <div className="veil" />
        <div className="type-pill">{show.type === 'SERIES' ? 'Série' : 'Anime'}</div>
        <div className="title">{show.title}</div>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between' }}>
        <span>{show.year ?? '—'}</span>
      </div>
    </button>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [filt, setFilt] = useState<'all' | 'SERIES' | 'ANIME'>('all');
  const [onlyMyPlatforms, setOnlyMyPlatforms] = useState(false);
  const [local, setLocal] = useState<Show[]>([]);
  const [remote, setRemote] = useState<RemoteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.length < 2) { setLocal([]); setRemote([]); return; }

    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q });
        if (filt !== 'all') params.set('type', filt);
        const data = await apiFetch<{ local: Show[]; remote: RemoteResult[] }>(`/api/shows/search?${params}`);
        setLocal(data.local ?? []);
        setRemote(data.remote ?? []);
      } catch {
        setLocal([]); setRemote([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [q, filt]);

  const handleImport = (result: RemoteResult) => {
    startTransition(async () => {
      const payload = result.tmdbId
        ? { tmdbId: result.tmdbId }
        : { anilistId: result.anilistId };

      const res = await fetch('/api/shows/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.id) router.push(`/show/${data.id}`);
    });
  };

  const filteredLocal = onlyMyPlatforms
    ? local // Le filtre plateforme nécessite une vraie relation provider en DB — laissé pour plus tard
    : local;

  const hasResults = filteredLocal.length > 0 || remote.length > 0;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Recherche</h1>
          <div className="sub">Base locale d&apos;abord — fallback TMDB / AniList si rien ne correspond.</div>
        </div>
      </div>

      <div className="search-bar">
        <Icon name="search" size={18} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Titre, studio, acteur…"
          autoFocus
        />
        {loading && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>Recherche…</span>
        )}
        {q && !loading && (
          <button className="chip" onClick={() => { setQ(''); setLocal([]); setRemote([]); }}>
            Effacer
          </button>
        )}
      </div>

      <div className="filter-chips">
        {([['all', 'Tout'], ['SERIES', 'Séries'], ['ANIME', 'Animes']] as const).map(([k, l]) => (
          <button key={k} className={`chip ${filt === k ? 'on' : ''}`} onClick={() => setFilt(k)}>{l}</button>
        ))}
        <button
          className={`chip ${onlyMyPlatforms ? 'on' : ''}`}
          onClick={() => setOnlyMyPlatforms(v => !v)}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="check" size={11} /> Mes plateformes
          </span>
        </button>
        {hasResults && (
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="sparkle" size={12} />
            {filteredLocal.length + remote.length} résultat{filteredLocal.length + remote.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Résultats locaux */}
      {filteredLocal.length > 0 && (
        <>
          <div className="section-h">
            <h2>Dans ta bibliothèque <span className="count">· {filteredLocal.length}</span></h2>
          </div>
          <div className="poster-grid">
            {filteredLocal.map(s => <LocalCard key={s.id} show={s} />)}
          </div>
        </>
      )}

      {/* Résultats distants */}
      {remote.length > 0 && (
        <>
          <div className="section-h">
            <h2>
              {filteredLocal.length > 0 ? 'Aussi sur TMDB / AniList' : 'Résultats TMDB / AniList'}
              <span className="count"> · {remote.length}</span>
            </h2>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Clic → import + sync</span>
          </div>
          <div className="poster-grid">
            {remote.map((r, i) => (
              <RemoteCard key={r.tmdbId ?? r.anilistId ?? i} result={r} onImport={handleImport} />
            ))}
          </div>
        </>
      )}

      {/* État vide */}
      {q.length >= 2 && !loading && !hasResults && (
        <div className="empty">
          <Icon name="search" size={28} />
          <h3>Aucun résultat</h3>
          <p>Ni en local, ni sur TMDB / AniList. Vérifie l&apos;orthographe ou les clés API dans <code>.env.local</code>.</p>
        </div>
      )}

      {q.length < 2 && (
        <div style={{ marginTop: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13.5 }}>
          <Icon name="search" size={22} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
          Tape au moins 2 caractères pour lancer la recherche
        </div>
      )}

      <div style={{ marginTop: 40, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
        <JustWatchCredit />
      </div>
    </div>
  );
}
