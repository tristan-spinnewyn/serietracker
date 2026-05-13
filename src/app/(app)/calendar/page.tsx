'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { paletteFor } from '@/lib/constants';
import { apiFetch } from '@/lib/fetch';
import { toggleShowNotif } from '@/lib/actions/shows';

interface CalEpisode {
  id: string;
  showId: string;
  showTitle: string;
  showType: 'SERIES' | 'ANIME';
  seasonNumber: number;
  episodeNumber: number;
  airDate: string;
  notifyEnabled: boolean;
}

const DAY_HEADS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function buildCells(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const leading = firstDay === 0 ? 6 : firstDay - 1;  // Mon-based
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { dim: boolean; d: number; date?: Date }[] = [];
  for (let i = 0; i < leading; i++) {
    const d = new Date(year, month, -leading + i + 1);
    cells.push({ dim: true, d: d.getDate() });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ dim: false, d, date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) cells.push({ dim: true, d: cells.length - leading - daysInMonth + 1 });
  return cells;
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [filter, setFilter] = useState<'all' | 'SERIES' | 'ANIME'>('all');
  const [scope, setScope] = useState<'me' | 'all'>('me');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [episodes, setEpisodes] = useState<CalEpisode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifyMap, setNotifyMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ year: String(year), month: String(month + 1), scope });
    apiFetch<{ episodes: CalEpisode[] }>(`/api/calendar?${params}`)
      .then(d => {
        const eps = d.episodes ?? [];
        setEpisodes(eps);
        const map: Record<string, boolean> = {};
        eps.forEach(e => { map[e.showId] = e.notifyEnabled; });
        setNotifyMap(map);
      })
      .catch(() => setError('Impossible de charger le calendrier.'))
      .finally(() => setLoading(false));
  }, [year, month, scope]);

  const handleToggleNotify = (showId: string) => {
    const next = !(notifyMap[showId] ?? true);
    setNotifyMap(prev => ({ ...prev, [showId]: next }));
    toggleShowNotif(showId, next);
  };

  const cells = buildCells(year, month);

  const epsForDay = (d: number) =>
    episodes.filter(e => {
      const date = new Date(e.airDate);
      if (date.getDate() !== d || date.getMonth() !== month || date.getFullYear() !== year) return false;
      if (filter === 'SERIES') return e.showType === 'SERIES';
      if (filter === 'ANIME')  return e.showType === 'ANIME';
      return true;
    });

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Calendrier</h1>
          <div className="sub">{scope === 'me' ? 'Tes shows uniquement' : 'Tous les shows de la famille'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-icon-only" onClick={prevMonth}><Icon name="chevL" size={16} /></button>
          <div className="cal-month-title">{MONTHS_FR[month]} {year}</div>
          <button className="btn btn-icon-only" onClick={nextMonth}><Icon name="chevR" size={16} /></button>
          <button className="btn" style={{ marginLeft: 8 }} onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}>
            Aujourd&apos;hui
          </button>
        </div>
      </div>

      <div className="cal-toolbar">
        <div className="seg">
          <button className={scope === 'me' ? 'on' : ''} onClick={() => setScope('me')}>Personnel</button>
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>Global</button>
        </div>
        <div className="seg">
          <button className={filter === 'all' ? 'on' : ''}     onClick={() => setFilter('all')}>Tout</button>
          <button className={filter === 'SERIES' ? 'on' : ''}  onClick={() => setFilter('SERIES')}>Séries</button>
          <button className={filter === 'ANIME' ? 'on' : ''}   onClick={() => setFilter('ANIME')}>Animes</button>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <div className="seg">
            <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}>Grille</button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>Liste</button>
          </div>
        </div>
      </div>

      {loading && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>Chargement…</div>}
      {error && <div style={{ fontSize: 13, color: '#FECACA', marginBottom: 12 }}>{error}</div>}

      {view === 'grid' ? (
        <div className="cal-grid">
          {DAY_HEADS.map(h => <div key={h} className="cal-head">{h}</div>)}
          {cells.map((c, i) => {
            const eps = !c.dim ? epsForDay(c.d) : [];
            const isToday = !c.dim && c.d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            return (
              <div key={i} className={`cal-cell ${c.dim ? 'dim' : ''} ${isToday ? 'today' : ''}`}>
                <div className="d">{c.d}</div>
                {eps.slice(0, 3).map((e, j) => {
                  const pal = paletteFor(e.showTitle);
                  return (
                    <Link key={j} href={`/show/${e.showId}`} className={`cal-mini ${e.showType === 'ANIME' ? 'anime' : 'series'}`} title={e.showTitle}>
                      <div className="swatch" style={{ background: `linear-gradient(150deg, ${pal[0]}, ${pal[1]})` }} />
                      <div className="label">{e.showTitle}</div>
                      <div className="ep">E{e.episodeNumber}</div>
                    </Link>
                  );
                })}
                {eps.length > 3 && <div className="cal-more">+{eps.length - 3}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="upcoming">
          {episodes.filter(e => {
            const d = new Date(e.airDate);
            if (d.getMonth() !== month || d.getFullYear() !== year) return false;
            if (filter === 'SERIES') return e.showType === 'SERIES';
            if (filter === 'ANIME')  return e.showType === 'ANIME';
            return true;
          }).sort((a, b) => new Date(a.airDate).getTime() - new Date(b.airDate).getTime()).map((e, i) => {
            const d = new Date(e.airDate);
            return (
              <div className="up-row" key={i}>
                <div className="when">
                  <span className="day">{d.getDate()}</span>
                  <span className="mo">{MONTHS_FR[d.getMonth()].slice(0, 3).toUpperCase()}</span>
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{e.showTitle}</div>
                  <div className="ep-meta">
                    <span className={`pill ${e.showType === 'SERIES' ? 'series' : 'anime'}`}>{e.showType === 'SERIES' ? 'Série' : 'Anime'}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>S{e.seasonNumber} · E{e.episodeNumber}</span>
                  </div>
                </div>
                <button
                  className={`bell ${notifyMap[e.showId] !== false ? 'on' : ''}`}
                  onClick={() => handleToggleNotify(e.showId)}
                  title={notifyMap[e.showId] !== false ? 'Désactiver les notifications' : 'Activer les notifications'}
                >
                  <Icon name="bell" size={16} />
                </button>
                <Link href={`/show/${e.showId}`} className="icon-btn" title="Voir la fiche">
                  <Icon name="chevR" size={16} />
                </Link>
              </div>
            );
          })}
          {episodes.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              Aucun épisode ce mois-ci.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
