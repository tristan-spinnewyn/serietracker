'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/icon';
import type { SeasonProps } from './show-detail-types';

interface Props {
  seasons: SeasonProps[];
  watched: Set<string>;
  isAnime: boolean;
  onToggleEpisode: (episodeId: string) => void;
  onMarkWatched: (episodeIds: string[]) => void;
}

export function SeasonList({ seasons, watched, isAnime, onToggleEpisode, onMarkWatched }: Props) {
  const [openSeasons, setOpenSeasons] = useState<Set<string>>(
    () => new Set(seasons.find(s => s.watchedCount < s.episodeCount)?.id ? [seasons.find(s => s.watchedCount < s.episodeCount)!.id] : [])
  );
  const [openEpMenu, setOpenEpMenu] = useState<string | null>(null);

  useEffect(() => {
    if (!openEpMenu) return;
    const close = () => setOpenEpMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openEpMenu]);

  const toggleSeason = (id: string) => {
    setOpenSeasons(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Marks every aired, unwatched episode of the season up to (and including) epId
  const handleMarkUpTo = (season: SeasonProps, epId: string) => {
    const idx = season.episodes.findIndex(e => e.id === epId);
    const toMark = season.episodes
      .slice(0, idx + 1)
      .filter(e => e.hasAired && !watched.has(e.id))
      .map(e => e.id);
    if (!toMark.length) return;
    onMarkWatched(toMark);
    setOpenEpMenu(null);
  };

  return (
    <>
      {/* Saisons */}
      <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', fontWeight: 600, margin: '0 0 12px' }}>
        Saisons
      </h3>
      {seasons.length === 0 && (
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Aucune saison enregistrée.</p>
      )}
      {seasons.map(s => {
        const isOpen = openSeasons.has(s.id);
        const watchedCount = s.episodes.filter(e => watched.has(e.id)).length;
        const pct = s.episodeCount > 0 ? Math.round((watchedCount / s.episodeCount) * 100) : 0;
        return (
          <div className="season" key={s.id}>
            <div className="season-h" onClick={() => toggleSeason(s.id)}>
              <div>
                <div className="t">{s.title}</div>
                <div className="sub">{s.episodeCount} épisodes{s.year ? ` · ${s.year}` : ''}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="progress-bar" style={{ width: 140 }}>
                  <i style={{ width: `${pct}%` }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {watchedCount}/{s.episodeCount}
                </span>
              </div>
              <Icon name={isOpen ? 'chevU' : 'chevD'} size={16} />
            </div>
            {isOpen && (
              <div className="season-body">
                {s.episodes.map(e => {
                  const isDone = watched.has(e.id);
                  const notYet = !e.hasAired;
                  return (
                    <div
                      key={e.id}
                      className={`ep-row ${isDone ? 'done' : ''}`}
                      onClick={() => !notYet && onToggleEpisode(e.id)}
                      style={{ opacity: notYet ? 0.4 : 1, cursor: notYet ? 'default' : 'pointer' }}
                    >
                      <div className="chk">{isDone && <Icon name="check" size={14} />}</div>
                      <div>
                        <div className="num">S{s.number} · E{e.number}</div>
                        <div className="runtime">{e.runtime}</div>
                      </div>
                      <div>
                        <div className="t">{e.title}</div>
                        {e.isNext && !isDone && !notYet && (
                          <div style={{ fontSize: 11, color: isAnime ? 'var(--anime)' : 'var(--series)', marginTop: 3, fontWeight: 600 }}>
                            ● Prochain épisode
                          </div>
                        )}
                        {notYet && (
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
                            Pas encore diffusé
                          </div>
                        )}
                      </div>
                      <div className="date">{e.airDate}</div>
                      <div style={{ position: 'relative' }} onClick={ev => ev.stopPropagation()}>
                        <button
                          className="more"
                          onClick={() => !notYet && setOpenEpMenu(o => o === e.id ? null : e.id)}
                          style={{ opacity: notYet ? 0 : 1, pointerEvents: notYet ? 'none' : 'auto' }}
                        >
                          <Icon name="more" size={16} />
                        </button>
                        {openEpMenu === e.id && (
                          <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 20, background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 8, padding: 4, minWidth: 190, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                            <button
                              onClick={() => handleMarkUpTo(s, e.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}
                              onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-3)')}
                              onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                            >
                              <Icon name="check" size={13} />Marquer jusqu&apos;ici
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
