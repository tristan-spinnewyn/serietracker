'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
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

function RemoteCard({ result, onImport }: { result: RemoteResult; onImport: (r: RemoteResult) => Promise<boolean> }) {
  const [loading, setLoading] = useState(false);
  const imgUrl = result.posterPath
    ? result.tmdbId
      ? `${TMDB_IMG}${result.posterPath}`
      : result.posterPath
    : null;

  return (
    <button
      onClick={async () => {
        setLoading(true);
        // On success the page navigates away; on failure the card must be usable again
        if (!(await onImport(result))) setLoading(false);
      }}
      disabled={loading}
      style={{ display: 'block', background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
    >
      <div className={`poster ${result.type === 'SERIES' ? 'series' : 'anime'}`} style={{ position: 'relative' }}>
        {imgUrl ? (
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
          <img src={imgUrl} alt={show.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className="bg" style={{ background: `linear-gradient(150deg, ${pal[0]}, ${pal[1]})` }} />
        )}
        <div className="grain" />
        <div className="veil" />
        <div className="type-pill">{show.type === 'SERIES' ? 'Série' : 'Anime'}</div>
        <div className="title">{show.title}</div>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{show.year ?? '—'}</span>
        <ProviderRow ids={show.providers ?? []} links={show.providerLinks as Record<string, string> ?? {}} size={16} max={3} />
      </div>
    </button>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [filt, setFilt] = useState<'all' | 'SERIES' | 'ANIME'>('all');
  const [onlyMyPlatforms, setOnlyMyPlatforms] = useState(false);
  const [localResults, setLocalResults] = useState<Show[]>([]);
  const [remoteResults, setRemoteResults] = useState<RemoteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Queries shorter than 2 characters show nothing, whatever the last results were
  const hasQuery = q.length >= 2;
  const local = hasQuery ? localResults : [];
  const remote = hasQuery ? remoteResults : [];
  const searchError = hasQuery ? lastError : null;

  useEffect(() => {
    if (!hasQuery) return;

    // Cleared when the query changes, so a slow response never replaces newer results
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setLastError(null);
      try {
        const params = new URLSearchParams({ q });
        if (filt !== 'all') params.set('type', filt);
        if (onlyMyPlatforms) params.set('onlyMyPlatforms', 'true');
        const data = await apiFetch<{ local: Show[]; remote: RemoteResult[] }>(`/api/shows/search?${params}`);
        if (!active) return;
        setLocalResults(data.local ?? []);
        setRemoteResults(data.remote ?? []);
      } catch {
        if (!active) return;
        setLastError('Impossible de lancer la recherche.');
        setLocalResults([]); setRemoteResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [q, hasQuery, filt, onlyMyPlatforms]);

  const handleImport = async (result: RemoteResult): Promise<boolean> => {
    setImportError(null);
    const payload = result.tmdbId
      ? { tmdbId: result.tmdbId }
      : { anilistId: result.anilistId };

    try {
      const data = await apiFetch<{ id: string }>('/api/shows/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      startTransition(() => router.push(`/show/${data.id}`));
      return true;
    } catch (e) {
      // apiFetch surfaces the API's own message (rate limit, upstream failure…)
      setImportError(e instanceof Error ? e.message : 'Import impossible.');
      return false;
    }
  };

  const hasResults = local.length > 0 || remote.length > 0;

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
        {searchError && (
          <span style={{ fontSize: 11, color: '#FECACA', flexShrink: 0 }}>{searchError}</span>
        )}
        {q && !loading && (
          <button className="chip" onClick={() => setQ('')}>
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
            {local.length + remote.length} résultat{local.length + remote.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Résultats locaux */}
      {local.length > 0 && (
        <>
          <div className="section-h">
            <h2>Dans ta bibliothèque <span className="count">· {local.length}</span></h2>
          </div>
          <div className="poster-grid">
            {local.map(s => <LocalCard key={s.id} show={s} />)}
          </div>
        </>
      )}

      {/* Résultats distants */}
      {remote.length > 0 && (
        <>
          <div className="section-h">
            <h2>
              {local.length > 0 ? 'Aussi sur TMDB / AniList' : 'Résultats TMDB / AniList'}
              <span className="count"> · {remote.length}</span>
            </h2>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Clic → import + sync</span>
          </div>
          {importError && (
            <div role="alert" style={{
              marginBottom: 12, padding: '8px 14px', borderRadius: 8, fontSize: 13,
              background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.25)', color: '#FECACA',
            }}>
              ✕ {importError}
            </div>
          )}
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
