'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { ProviderRow } from '@/components/ui/provider-logo';
import { resyncShow } from '@/lib/actions/shows';
import { LinkShowModal } from './link-show-modal';
import { REL_LABEL, STATUS_LABEL, WATCH_LABEL, type FollowerProps, type RelationItem, type ShowProps } from './show-detail-types';

export function InfoCard({ show, isAnime }: { show: ShowProps; isAnime: boolean }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [syncError, setSyncError] = useState(false);

  const handleResync = async () => {
    setSyncing(true);
    setSyncDone(false);
    setSyncError(false);
    try {
      await resyncShow(show.id);
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 3000);
      router.refresh();
    } catch {
      setSyncError(true);
      setTimeout(() => setSyncError(false), 4000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="side-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Infos</h3>
        <button
          className="btn"
          style={{ fontSize: 11, padding: '3px 8px', opacity: syncing ? 0.6 : 1 }}
          onClick={handleResync}
          disabled={syncing}
          title="Récupérer les dernières données depuis TMDB / AniList"
        >
          {syncDone
            ? <><Icon name="check" size={11} />Mis à jour</>
            : syncError
              ? '✕ Échec'
              : syncing
                ? 'Sync…'
                : <><Icon name="chevR" size={11} />Réimporter</>
          }
        </button>
      </div>
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
      {show.providers.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <ProviderRow ids={show.providers} links={show.providerLinks} size={22} label="Dispo sur" />
        </div>
      )}
    </div>
  );
}

export function RelationsCard({ showId, relations }: { showId: string; relations: RelationItem[] }) {
  const [liveRelations, setLiveRelations] = useState<RelationItem[]>(relations);
  const [showLinkModal, setShowLinkModal] = useState(false);

  return (
    <>
      {showLinkModal && (
        <LinkShowModal
          showId={showId}
          onClose={() => setShowLinkModal(false)}
          onLinked={(rel) => { setLiveRelations(prev => [...prev, rel]); setShowLinkModal(false); }}
        />
      )}
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
    </>
  );
}

export function FollowersCard({ followers }: { followers: FollowerProps[] }) {
  return (
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
  );
}
