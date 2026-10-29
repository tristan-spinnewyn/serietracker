'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import { syncFromAnilist } from '@/lib/actions/anilist-sync';
import type { SyncResult } from '@/lib/actions/anilist-sync';
import { Card, Input } from './settings-ui';

const ANILIST_SYNC_ERRORS: Record<Exclude<SyncResult['status'], 'ok'>, string> = {
  not_found: 'Utilisateur AniList introuvable ou liste privée.',
  rate_limited: "Trop d'imports AniList récents. Réessaie dans une heure.",
  error: "Erreur lors de l'import.",
};

export function AnilistSyncCard() {
  const [anilistUser, setAnilistUser] = useState('');
  const [result, setResult] = useState<SyncResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSync = () => {
    if (!anilistUser.trim()) return;
    setResult(null);
    startTransition(async () => {
      const res = await syncFromAnilist(anilistUser);
      setResult(res);
    });
  };

  return (
    <Card title="Import AniList">
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
        Importe ta liste AniList — les statuts et notes sont synchronisés. Les shows déjà présents ne sont pas écrasés sauf si le statut AniList est plus avancé.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input
          value={anilistUser}
          onChange={e => setAnilistUser(e.target.value)}
          placeholder="Ton pseudo AniList"
          onKeyDown={e => e.key === 'Enter' && handleSync()}
          style={{ flex: 1 }}
        />
        <button
          className="btn violet"
          onClick={handleSync}
          disabled={isPending || !anilistUser.trim()}
          style={{ flexShrink: 0, opacity: isPending ? 0.7 : 1 }}
        >
          {isPending ? 'Import…' : <><Icon name="plus" size={14} />Importer</>}
        </button>
      </div>
      {isPending && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
          Import en cours — peut prendre quelques minutes selon la taille de ta liste…
        </div>
      )}
      {result && result.status === 'ok' && (
        <div style={{
          marginTop: 12, padding: '8px 14px', borderRadius: 8, fontSize: 13,
          background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#6EE7B7',
        }}>
          ✓ {result.imported} show{result.imported !== 1 ? 's' : ''} importé{result.imported !== 1 ? 's' : ''}
          {result.skipped > 0 && `, ${result.skipped} déjà présent${result.skipped !== 1 ? 's' : ''}`}
          {result.errors > 0 && `, ${result.errors} erreur${result.errors !== 1 ? 's' : ''}`}
        </div>
      )}
      {result && result.status !== 'ok' && (
        <div style={{
          marginTop: 12, padding: '8px 14px', borderRadius: 8, fontSize: 13,
          background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.25)', color: '#FECACA',
        }}>
          ✕ {ANILIST_SYNC_ERRORS[result.status]}
        </div>
      )}
    </Card>
  );
}
