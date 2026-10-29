'use client';

import { useState, useTransition, useEffect } from 'react';
import { Icon } from '@/components/ui/icon';
import { linkShows } from '@/lib/actions/lists';
import { apiFetch } from '@/lib/fetch';
import type { RelationType } from '@prisma/client';
import { REL_LABEL, type RelationItem } from './show-detail-types';

export function LinkShowModal({ showId, onClose, onLinked }: {
  showId: string;
  onClose: () => void;
  onLinked: (rel: RelationItem) => void;
}) {
  const [q, setQ] = useState('');
  const [lastResults, setLastResults] = useState<{ id: string; title: string; type: string; year: number | null; tmdbId: number | null; anilistId: number | null; posterPath: string | null }[]>([]);
  const [relType, setRelType] = useState<RelationType>('SEQUEL');
  const [selected, setSelected] = useState<typeof lastResults[0] | null>(null);
  const [isPending, start] = useTransition();

  const hasQuery = q.length >= 2;
  const results = hasQuery ? lastResults : [];

  useEffect(() => {
    if (!hasQuery) return;
    let active = true;
    const timer = setTimeout(async () => {
      const d = await apiFetch<{ local: typeof lastResults }>(`/api/shows/search?q=${encodeURIComponent(q)}`);
      if (active) setLastResults((d.local ?? []).filter(s => s.id !== showId));
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [q, hasQuery, showId]);

  const handleLink = () => {
    if (!selected) return;
    start(async () => {
      const res = await linkShows(showId, selected.id, relType);
      if (res.success) {
        const TMDB_IMG = 'https://image.tmdb.org/t/p/w300';
        onLinked({
          id: selected.id,
          title: selected.title,
          type: selected.type,
          year: selected.year,
          status: 'RETURNING',
          posterUrl: selected.posterPath ? (selected.tmdbId ? `${TMDB_IMG}${selected.posterPath}` : selected.posterPath) : null,
          relationType: relType,
        });
      }
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,15,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-2)', borderRadius: 16, padding: 24, width: 420, boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Lier une œuvre</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        {/* Type de relation */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Type de lien</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.entries(REL_LABEL) as [RelationType, string][]).map(([k, l]) => (
              <button key={k} className={`chip ${relType === k ? 'on' : ''}`} style={{ fontSize: 11.5 }} onClick={() => setRelType(k)}>{l}</button>
            ))}
          </div>
        </div>

        {/* Recherche */}
        <div className="search-bar" style={{ marginBottom: 12 }}>
          <Icon name="search" size={16} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un show dans la bibliothèque…" style={{ flex: 1, background: 'transparent', border: 0, outline: 0, color: 'var(--text)', fontSize: 14 }} />
        </div>

        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results.map(r => (
            <button key={r.id} onClick={() => setSelected(s => s?.id === r.id ? null : r)}
              style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: selected?.id === r.id ? 'var(--bg-3)' : 'var(--bg-2)', border: `1px solid ${selected?.id === r.id ? 'var(--line-2)' : 'var(--line)'}`, textAlign: 'left', transition: 'all .15s' }}>
              <div style={{ width: 28, height: 40, borderRadius: 3, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-3)' }}>
                {r.posterPath && <img src={r.tmdbId ? `https://image.tmdb.org/t/p/w92${r.posterPath}` : r.posterPath} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{r.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.type === 'ANIME' ? 'Anime' : 'Série'}{r.year ? ` · ${r.year}` : ''}</div>
              </div>
              {selected?.id === r.id && <Icon name="check" size={14} style={{ marginLeft: 'auto', color: 'var(--green)', flexShrink: 0 }} />}
            </button>
          ))}
          {q.length >= 2 && results.length === 0 && (
            <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>Aucun résultat local — importe d&apos;abord le show.</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn violet" disabled={!selected || isPending} onClick={handleLink} style={{ opacity: !selected || isPending ? 0.6 : 1 }}>
            <Icon name="share" size={13} />{isPending ? 'Liaison…' : 'Lier'}
          </button>
        </div>
      </div>
    </div>
  );
}
