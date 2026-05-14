'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import { markAllCompletedEpisodesWatched } from '@/lib/actions/shows';

export function MarkAllWatchedButton() {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<number | null>(null);

  const handleClick = () => {
    setDone(null);
    startTransition(async () => {
      const { count } = await markAllCompletedEpisodesWatched();
      setDone(count);
    });
  };

  if (done !== null && done === 0) return (
    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Déjà à jour ✓</span>
  );

  if (done !== null) return (
    <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ {done} épisode{done > 1 ? 's' : ''} cochés</span>
  );

  return (
    <button
      className="btn"
      onClick={handleClick}
      disabled={isPending}
      style={{ opacity: isPending ? 0.7 : 1 }}
    >
      <Icon name="check" size={14} />
      {isPending ? 'En cours…' : 'Tout cocher'}
    </button>
  );
}
