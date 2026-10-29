'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import { rateShow } from '@/lib/actions/shows';
import type { NextEpProps } from './show-detail-types';

export function ProgressCard({ totalWatched, totalEps, runtime, hasUnwatchedAired, isPending, onMarkAll, onUnmarkAll }: {
  totalWatched: number;
  totalEps: number;
  runtime: number | null;
  hasUnwatchedAired: boolean;
  isPending: boolean;
  onMarkAll: () => void;
  onUnmarkAll: () => void;
}) {
  return (
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
      {runtime && (
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8 }}>
          ~{Math.round(totalWatched * runtime / 60)}h regardées · {Math.round((totalEps - totalWatched) * runtime / 60)}h restantes
        </div>
      )}
      {hasUnwatchedAired && (
        <button
          className="btn"
          style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
          onClick={onMarkAll}
          disabled={isPending}
        >
          <Icon name="check" size={14} />Tout marquer comme vu
        </button>
      )}
      {totalWatched > 0 && (
        <button
          className="btn"
          style={{ width: '100%', justifyContent: 'center', marginTop: hasUnwatchedAired ? 6 : 12 }}
          onClick={onUnmarkAll}
          disabled={isPending}
        >
          <Icon name="x" size={14} />Tout marquer comme non vu
        </button>
      )}
    </div>
  );
}

export function RatingCard({ showId, initialRating }: { showId: string; initialRating: number | null }) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  // Clicking the current rating clears it
  const handleRate = (stars: number) => {
    const next = rating === stars ? 0 : stars;
    setRating(next || null);
    startTransition(() => rateShow(showId, next));
  };

  return (
    <div className="side-card">
      <h3>Ma note</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, margin: '10px 0 8px' }}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(null)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '2px 4px', fontSize: 28, lineHeight: 1,
              color: (hoverRating ?? rating ?? 0) >= star ? '#FBBF24' : 'var(--line-2)',
              transition: 'color .12s',
            }}
            title={`${star} étoile${star > 1 ? 's' : ''}`}
          >★</button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        {rating
          ? <><span style={{ color: '#FBBF24', fontWeight: 600 }}>{rating}</span><span> / 5</span></>
          : 'Pas encore noté'}
      </div>
    </div>
  );
}

export function NextEpisodeCard({ nextEp, isAnime, isWatched, isPending, onToggle }: {
  nextEp: NextEpProps;
  isAnime: boolean;
  isWatched: boolean;
  isPending: boolean;
  onToggle: () => void;
}) {
  return (
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
        onClick={onToggle}
        disabled={isPending}
      >
        <Icon name="play" size={12} />
        {isWatched ? 'Déjà vu ✓' : 'Marquer comme vu'}
      </button>
    </div>
  );
}
