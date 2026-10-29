'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { ProviderRow } from '@/components/ui/provider-logo';
import type { WatchStatus } from '@prisma/client';
import { AddToListModal } from './add-to-list-modal';
import { STATUS_LABEL, WATCH_LABEL, type ShowProps } from './show-detail-types';

const FALLBACK_BACKDROP = `radial-gradient(at 70% 30%, #A855F733 0%, transparent 50%), radial-gradient(at 10% 80%, #FB718577 0%, transparent 60%), linear-gradient(135deg, #1E1B4B 0%, #0A0A0F 70%)`;

interface Props {
  show: ShowProps;
  isAnime: boolean;
  userStatus: WatchStatus | null;
  totalEps: number;
  notifyEnabled: boolean;
  isPending: boolean;
  onStatusChange: (status: WatchStatus) => void;
  onToggleNotify: () => void;
  onRemove: () => void;
}

export function ShowHero({ show, isAnime, userStatus, totalEps, notifyEnabled, isPending, onStatusChange, onToggleNotify, onRemove }: Props) {
  const [copied, setCopied] = useState(false);
  const [showListModal, setShowListModal] = useState(false);

  const backdropBg = show.backdropUrl ? undefined : FALLBACK_BACKDROP;

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {showListModal && <AddToListModal showId={show.id} onClose={() => setShowListModal(false)} />}
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
            {show.providers.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <ProviderRow ids={show.providers} links={show.providerLinks} size={24} />
              </div>
            )}
            <div className="detail-actions">
              <button
                className="btn"
                onClick={() => {
                  if (!userStatus) onStatusChange('PLAN_TO_WATCH');
                  else if (userStatus === 'PLAN_TO_WATCH') onStatusChange('WATCHING');
                  else if (userStatus === 'WATCHING') onStatusChange('PAUSED');
                  else onStatusChange('WATCHING');
                }}
                disabled={isPending}
              >
                <Icon name="check" size={14} />
                {userStatus ? WATCH_LABEL[userStatus] : 'À regarder'}
              </button>
              <button
                className={`btn ${notifyEnabled ? 'active' : ''}`}
                onClick={onToggleNotify}
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
            {userStatus && (
              <button
                onClick={onRemove}
                disabled={isPending}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-3)', padding: '4px 0', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                Retirer de ma liste
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
