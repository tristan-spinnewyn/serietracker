'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { toggleEpisode, upsertUserShow, toggleShowNotif, markEpisodesWatchedBatch } from '@/lib/actions/shows';
import { addShowToList, linkShows } from '@/lib/actions/lists';
import { apiFetch } from '@/lib/fetch';
import type { WatchStatus, RelationType } from '@prisma/client';

interface ListOption { id: string; name: string; emoji: string; color: string; itemCount: number; hasShow: boolean; }

function LinkShowModal({ showId, onClose, onLinked }: {
  showId: string;
  onClose: () => void;
  onLinked: (rel: RelationItem) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; title: string; type: string; year: number | null; tmdbId: number | null; anilistId: number | null; posterPath: string | null }[]>([]);
  const [relType, setRelType] = useState<RelationType>('SEQUEL');
  const [selected, setSelected] = useState<typeof results[0] | null>(null);
  const [isPending, start] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.length < 2) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      const d = await apiFetch<{ local: typeof results }>(`/api/shows/search?q=${encodeURIComponent(q)}`);
      setResults((d.local ?? []).filter(s => s.id !== showId));
    }, 300);
  }, [q, showId]);

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

function AddToListModal({ showId, onClose }: { showId: string; onClose: () => void }) {
  const [lists, setLists] = useState<ListOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ lists: { id: string; name: string; emoji: string; color: string; items: { show: { id: string } }[] }[] }>('/api/lists')
      .then(d => setLists((d.lists ?? []).map(l => ({
        id: l.id,
        name: l.name,
        emoji: l.emoji,
        color: l.color,
        itemCount: l.items.length,
        hasShow: l.items.some(i => i.show.id === showId),
      }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [showId]);

  const handleAdd = (listId: string) => {
    start(async () => {
      await addShowToList(listId, showId);
      setAdded(listId);
      setLists(prev => prev.map(l => l.id === listId ? { ...l, hasShow: true, itemCount: l.itemCount + 1 } : l));
    });
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,15,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-2)', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Ajouter à une liste</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        {loading && <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '8px 0' }}>Chargement…</div>}

        {!loading && lists.length === 0 && (
          <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '8px 0', textAlign: 'center' }}>
            Aucune liste — crée-en une depuis la page <a href="/lists" style={{ color: 'var(--series)' }}>Listes</a>.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lists.map(l => (
            <button
              key={l.id}
              onClick={() => !l.hasShow && handleAdd(l.id)}
              disabled={l.hasShow || pending}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10, cursor: l.hasShow ? 'default' : 'pointer',
                background: added === l.id ? 'rgba(52,211,153,0.1)' : 'var(--bg-2)',
                border: `1px solid ${added === l.id ? 'rgba(52,211,153,0.3)' : l.hasShow ? 'var(--line)' : 'var(--line)'}`,
                opacity: l.hasShow && added !== l.id ? 0.5 : 1,
                transition: 'background .15s, border-color .15s', textAlign: 'left',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
              <span style={{ fontSize: 15, flexShrink: 0 }}>{l.emoji}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>{l.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>{l.itemCount}</span>
              {l.hasShow
                ? <span style={{ fontSize: 11, color: '#6EE7B7' }}>✓ Ajouté</span>
                : <Icon name="plus" size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              }
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

const REL_LABEL: Record<string, string> = {
  SEQUEL:      'Suite',
  PREQUEL:     'Préquelle',
  SPINOFF:     'Spin-off',
  ALTERNATIVE: 'Version alternative',
  PARENT:      'Œuvre originale',
  RELATED:     'Lié',
};

const STATUS_LABEL: Record<string, string> = {
  RETURNING: 'En cours', ENDED: 'Terminée', CANCELED: 'Annulée',
  UPCOMING: 'À venir', IN_PRODUCTION: 'En production',
};
const WATCH_LABEL: Record<string, string> = {
  WATCHING: 'En cours', COMPLETED: 'Terminé', PLAN_TO_WATCH: 'À voir',
  DROPPED: 'Abandonné', PAUSED: 'En pause',
};

interface ShowProps {
  id: string; title: string; type: string; status: string;
  year: number | null; overview: string | null;
  posterUrl: string | null; backdropUrl: string | null;
  network: string | null; genre: string | null;
  runtime: number | null; totalSeasons: number;
}
interface EpisodeProps {
  id: string; number: number; title: string;
  runtime: string; airDate: string; watched: boolean; isNext: boolean;
}
interface SeasonProps {
  id: string; number: number; title: string; year: number | null;
  episodeCount: number; watchedCount: number; episodes: EpisodeProps[];
}
interface NextEpProps {
  id: string; seasonNumber: number; episodeNumber: number; title: string; airDate: string | null;
}
interface FollowerProps {
  user: { id: string; name: string; color: string; initials: string };
  status: string;
}

interface RelationItem {
  id: string; title: string; type: string; year: number | null;
  status: string; posterUrl: string | null; relationType: RelationType;
}

interface Props {
  show: ShowProps;
  seasons: SeasonProps[];
  nextEp: NextEpProps | null;
  userStatus: WatchStatus | null;
  notifyEnabled: boolean;
  followers: FollowerProps[];
  relations: RelationItem[];
  currentUserId: string;
}

export function ShowDetail({ show, seasons, nextEp, userStatus, notifyEnabled: initialNotify, followers, relations }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState('aperçu');
  const [openSeasons, setOpenSeasons] = useState<Set<string>>(
    () => new Set(seasons.find(s => s.watchedCount < s.episodeCount)?.id ? [seasons.find(s => s.watchedCount < s.episodeCount)!.id] : [])
  );
  const [watched, setWatched] = useState<Set<string>>(
    () => new Set(seasons.flatMap(s => s.episodes.filter(e => e.watched).map(e => e.id)))
  );
  const [isPending, startTransition] = useTransition();
  const [notifyEnabled, setNotifyEnabled] = useState(initialNotify);
  const [copied, setCopied] = useState(false);
  const [openEpMenu, setOpenEpMenu] = useState<string | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [liveRelations, setLiveRelations] = useState<RelationItem[]>(relations);

  useEffect(() => {
    if (!openEpMenu) return;
    const close = () => setOpenEpMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openEpMenu]);

  const isAnime = show.type === 'ANIME';

  const toggleSeason = (id: string) => {
    setOpenSeasons(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleToggleEp = (epId: string) => {
    const nowWatched = !watched.has(epId);
    setWatched(prev => {
      const next = new Set(prev);
      nowWatched ? next.add(epId) : next.delete(epId);
      return next;
    });
    startTransition(() => toggleEpisode(epId, nowWatched));
  };

  const handleStatus = (status: WatchStatus) => {
    startTransition(() => upsertUserShow({ showId: show.id, status }));
    router.refresh();
  };

  const handleToggleNotify = () => {
    const next = !notifyEnabled;
    setNotifyEnabled(next);
    startTransition(() => toggleShowNotif(show.id, next));
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMarkUpTo = (season: SeasonProps, epId: string) => {
    const idx = season.episodes.findIndex(e => e.id === epId);
    const toMark = season.episodes.slice(0, idx + 1).filter(e => !watched.has(e.id)).map(e => e.id);
    if (!toMark.length) return;
    setWatched(prev => { const next = new Set(prev); toMark.forEach(id => next.add(id)); return next; });
    startTransition(() => markEpisodesWatchedBatch(toMark));
    setOpenEpMenu(null);
  };

  const backdropBg = show.backdropUrl
    ? undefined
    : `radial-gradient(at 70% 30%, #A855F733 0%, transparent 50%), radial-gradient(at 10% 80%, #FB718577 0%, transparent 60%), linear-gradient(135deg, #1E1B4B 0%, #0A0A0F 70%)`;

  const totalWatched = seasons.reduce((a, s) => a + s.episodes.filter(e => watched.has(e.id)).length, 0);
  const totalEps = seasons.reduce((a, s) => a + s.episodeCount, 0);

  return (
    <div className={`page ${isAnime ? 'anime-detail' : ''}`}>
      {showListModal && <AddToListModal showId={show.id} onClose={() => setShowListModal(false)} />}
      {showLinkModal && (
        <LinkShowModal
          showId={show.id}
          onClose={() => setShowLinkModal(false)}
          onLinked={(rel) => { setLiveRelations(prev => [...prev, rel]); setShowLinkModal(false); }}
        />
      )}
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="hero">
        {show.backdropUrl
          ? <img src={show.backdropUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
          : <div className="backdrop" style={{ background: backdropBg }} />
        }
        <div className="veil" />
        <div className="inner">
          <div className="poster-lg">
            {show.posterUrl
              ? <img src={show.posterUrl} alt={show.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', background: 'var(--bg-2)' }} />
            }
          </div>
          <div style={{ flex: 1, paddingBottom: 6 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <span className={`pill ${isAnime ? 'anime' : 'series'}`}>{isAnime ? 'Anime' : 'Série'}</span>
              <span className="pill ghost">{STATUS_LABEL[show.status] ?? show.status}</span>
              {userStatus && <span className="pill green">{WATCH_LABEL[userStatus]}</span>}
            </div>
            <h1>{show.title}</h1>
            <div className="meta">
              {show.year && <><span>{show.year}</span><span className="dot" /></>}
              {show.totalSeasons > 0 && <><span>{show.totalSeasons} saison{show.totalSeasons > 1 ? 's' : ''} · {totalEps} épisodes</span><span className="dot" /></>}
              {show.network && <><span>{show.network}</span><span className="dot" /></>}
              {show.genre && <span>{show.genre}</span>}
            </div>
            <div className="detail-actions">
              {nextEp && (
                <button
                  className="btn primary"
                  onClick={() => handleToggleEp(nextEp.id)}
                  disabled={isPending}
                >
                  <Icon name="play" size={12} />
                  Reprendre · S{nextEp.seasonNumber} E{nextEp.episodeNumber}
                </button>
              )}
              <button
                className="btn"
                onClick={() => handleStatus(userStatus === 'WATCHING' ? 'PAUSED' : 'WATCHING')}
                disabled={isPending}
              >
                <Icon name="check" size={14} />
                {userStatus ? WATCH_LABEL[userStatus] : 'Ajouter'}
              </button>
              <button
                className={`btn ${notifyEnabled ? 'active' : ''}`}
                onClick={handleToggleNotify}
                disabled={isPending}
                title={notifyEnabled ? 'Désactiver les notifications' : 'Activer les notifications'}
              >
                <Icon name="bell" size={14} />{notifyEnabled ? 'Notifs on' : 'Notifs off'}
              </button>
              <button className="btn" onClick={() => setShowListModal(true)}><Icon name="plus" size={14} />Liste</button>
              <button
                className="btn btn-icon-only"
                onClick={handleShare}
                title={copied ? 'Lien copié !' : 'Copier le lien'}
              >
                <Icon name={copied ? 'check' : 'share'} size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Onglets ───────────────────────────────────────────── */}
      <div className="detail-tabs">
        {['Aperçu', 'Saisons'].map(t => (
          <button key={t} className={`detail-tab ${tab === t.toLowerCase() ? 'on' : ''}`} onClick={() => setTab(t.toLowerCase())}>
            {t}
          </button>
        ))}
      </div>

      <div className="detail-body">
        <div>
          {/* Synopsis */}
          {show.overview && (
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', fontWeight: 600, margin: '0 0 10px' }}>Synopsis</h3>
              <p className="synopsis">{show.overview}</p>
            </div>
          )}

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
                      return (
                        <div key={e.id} className={`ep-row ${isDone ? 'done' : ''}`} onClick={() => handleToggleEp(e.id)}>
                          <div className="chk">{isDone && <Icon name="check" size={14} />}</div>
                          <div>
                            <div className="num">S{s.number} · E{e.number}</div>
                            <div className="runtime">{e.runtime}</div>
                          </div>
                          <div>
                            <div className="t">{e.title}</div>
                            {e.isNext && !isDone && (
                              <div style={{ fontSize: 11, color: isAnime ? 'var(--anime)' : 'var(--series)', marginTop: 3, fontWeight: 600 }}>
                                ● Prochain épisode
                              </div>
                            )}
                          </div>
                          <div className="date">{e.airDate}</div>
                          <div style={{ position: 'relative' }} onClick={ev => ev.stopPropagation()}>
                            <button
                              className="more"
                              onClick={() => setOpenEpMenu(o => o === e.id ? null : e.id)}
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
        </div>

        {/* ── Sidebar droite ───────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Progression globale */}
          <div className="side-card">
            <h3>Ma progression</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                {totalWatched}<span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 400 }}>/{totalEps}</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{totalEps > 0 ? Math.round((totalWatched / totalEps) * 100) : 0}%</span>
            </div>
            <div className="progress-bar" style={{ width: '100%', height: 6 }}>
              <i style={{ width: `${totalEps > 0 ? Math.round((totalWatched / totalEps) * 100) : 0}%` }} />
            </div>
            {show.runtime && (
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8 }}>
                ~{Math.round(totalWatched * show.runtime / 60)}h regardées · {Math.round((totalEps - totalWatched) * show.runtime / 60)}h restantes
              </div>
            )}
          </div>

          {/* Prochain épisode */}
          {nextEp && (
            <div className="side-card">
              <h3>Prochain épisode</h3>
              <div className="kvrow" style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>{nextEp.title}</div>
                <span className={`pill ${isAnime ? 'anime' : 'series'}`}>S{nextEp.seasonNumber} · E{nextEp.episodeNumber}</span>
              </div>
              {nextEp.airDate && (
                <div className="kvrow">
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Diffusion</span>
                  <span style={{ fontSize: 13 }}>{nextEp.airDate}</span>
                </div>
              )}
              <button
                className="btn violet"
                style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                onClick={() => handleToggleEp(nextEp.id)}
                disabled={isPending}
              >
                <Icon name="play" size={12} />
                {watched.has(nextEp.id) ? 'Déjà vu ✓' : 'Marquer comme vu'}
              </button>
            </div>
          )}

          {/* Infos */}
          <div className="side-card">
            <h3>Infos</h3>
            {([
              ['Type', isAnime ? 'Anime' : 'Série'],
              ['Statut', STATUS_LABEL[show.status] ?? show.status],
              ...(show.network ? [['Réseau', show.network]] : []),
              ...(show.runtime ? [['Durée', `~${show.runtime} min`]] : []),
              ...(show.genre ? [['Genre', show.genre]] : []),
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="kvrow" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{k}</span>
                <span style={{ fontSize: 13 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Famille */}
          {/* Relations */}
          <div className="side-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Œuvres liées</h3>
              <button
                className="btn"
                style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={() => setShowLinkModal(true)}
              >
                <Icon name="plus" size={11} /> Lier
              </button>
            </div>
            {liveRelations.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '8px 0' }}>
                Aucune liaison — utilise le bouton<br />ou réimporte depuis AniList.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {liveRelations.map(r => (
                  <a key={r.id} href={`/show/${r.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none', padding: '4px 0' }}>
                    <div style={{ width: 36, height: 52, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-3)' }}>
                      {r.posterUrl
                        ? <img src={r.posterUrl} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', background: `linear-gradient(150deg, ${r.type === 'ANIME' ? '#4A044E,#EC4899' : '#1E1B4B,#6366F1'})` }} />
                      }
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        {REL_LABEL[r.relationType] ?? r.relationType}
                        {r.year ? ` · ${r.year}` : ''}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {followers.length > 0 && (
            <div className="side-card">
              <h3>La famille regarde</h3>
              {followers.map(f => (
                <div key={f.user.id} className="follower">
                  <div
                    className="avatar"
                    style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${f.user.color}, ${f.user.color}99)`, borderColor: 'transparent' }}
                  >
                    {f.user.initials}
                  </div>
                  <div>
                    <div className="name">{f.user.name}</div>
                    <div className="pos">{WATCH_LABEL[f.status] ?? f.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
