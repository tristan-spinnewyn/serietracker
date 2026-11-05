'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { PALETTES } from '@/lib/constants';
import { apiFetch } from '@/lib/fetch';
import { JustWatchCredit } from '@/components/ui/justwatch-credit';
import { hasAnimeSearchFilters, toAnimeSearchParams, type AnimeSearchFilters } from '@/lib/anilist/search-filters';
import { AnimeFilters } from './anime-filters';

// A TMDB or AniList search result; importing it reuses the show if already in the catalog
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

export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [filt, setFilt] = useState<'all' | 'SERIES' | 'ANIME'>('all');
  const [lastResults, setLastResults] = useState<RemoteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [animeFilters, setAnimeFilters] = useState<AnimeSearchFilters>({});
  const [, startTransition] = useTransition();

  // Anime filters only apply while the anime type is picked
  const activeAnimeFilters = useMemo(() => (filt === 'ANIME' ? animeFilters : {}), [filt, animeFilters]);
  const browsing = hasAnimeSearchFilters(activeAnimeFilters);
  // Queries shorter than 2 characters show nothing, whatever the last results were, unless browsing
  const hasQuery = q.length >= 2 || browsing;
  const results = hasQuery ? lastResults : [];
  const searchError = hasQuery ? lastError : null;

  useEffect(() => {
    if (!hasQuery) return;

    // Cleared when the query changes, so a slow response never replaces newer results
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setLastError(null);
      try {
        const params = new URLSearchParams({ q: q.length >= 2 ? q : '' });
        if (filt !== 'all') params.set('type', filt);
        toAnimeSearchParams(activeAnimeFilters, params);
        const data = await apiFetch<{ results: RemoteResult[] }>(`/api/shows/search?${params}`);
        if (!active) return;
        setLastResults(data.results ?? []);
      } catch {
        if (!active) return;
        setLastError('Impossible de lancer la recherche.');
        setLastResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [q, hasQuery, filt, activeAnimeFilters]);

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

  const hasResults = results.length > 0;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Recherche</h1>
          <div className="sub">Recherche directement sur TMDB et AniList.</div>
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
        {hasResults && (
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="sparkle" size={12} />
            {results.length} résultat{results.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {filt === 'ANIME' && <AnimeFilters value={animeFilters} onChange={setAnimeFilters} />}

      {hasResults && (
        <>
          <div className="section-h">
            <h2>
              Résultats TMDB / AniList
              <span className="count"> · {results.length}</span>
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
            {results.map((r, i) => (
              <RemoteCard key={r.tmdbId ? `tmdb-${r.tmdbId}` : `anilist-${r.anilistId ?? i}`} result={r} onImport={handleImport} />
            ))}
          </div>
        </>
      )}

      {/* État vide */}
      {hasQuery && !loading && !hasResults && (
        <div className="empty">
          <Icon name="search" size={28} />
          <h3>Aucun résultat</h3>
          <p>Rien sur TMDB / AniList. Vérifie l&apos;orthographe ou les clés API dans <code>.env.local</code>.</p>
        </div>
      )}

      {!hasQuery && (
        <div style={{ marginTop: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13.5 }}>
          <Icon name="search" size={22} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
          Tape au moins 2 caractères pour lancer la recherche
          {filt === 'ANIME' && ', ou choisis un genre, une saison ou une année'}
        </div>
      )}

      <div style={{ marginTop: 40, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
        <JustWatchCredit />
      </div>
    </div>
  );
}
