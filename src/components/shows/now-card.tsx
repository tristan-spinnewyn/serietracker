'use client';

import { useRouter } from 'next/navigation';
import { Poster } from '@/components/ui/poster';
import { Icon } from '@/components/ui/icon';

export interface NowCardData {
  id: string;
  title: string;
  type: 'SERIES' | 'ANIME';
  genre: string | null;
  posterUrl: string | null;
  watchedCount: number;
  totalEps: number;
  nextEp?: { s: number; e: number; title: string; date: string } | null;
}

export function NowCard({ show }: { show: NowCardData }) {
  const router = useRouter();
  const pct = show.totalEps > 0 ? Math.round((show.watchedCount / show.totalEps) * 100) : 0;

  return (
    <button className={`now-card ${show.type === 'ANIME' ? 'anime' : 'series'}`} onClick={() => router.push(`/show/${show.id}`)}>
      <Poster title={show.title} type={show.type} imageUrl={show.posterUrl} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="t" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{show.title}</div>
          {show.genre && <div className="sub">{show.genre}</div>}
        </div>
      </div>
      <div className="progress">
        <div className="progress-bar"><i style={{ width: `${pct}%` }} /></div>
        <span>{show.watchedCount}/{show.totalEps}</span>
      </div>
      {show.nextEp ? (
        <div className="next">
          <div>
            <div className="ep">S{show.nextEp.s} · E{show.nextEp.e} — {show.nextEp.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{show.nextEp.date}</div>
          </div>
          <div className="play"><Icon name="play" size={10} /></div>
        </div>
      ) : (
        <div className="next" style={{ background: 'transparent', border: '1px dashed var(--line)' }}>
          <div className="ep">Aucun épisode à venir</div>
        </div>
      )}
    </button>
  );
}
