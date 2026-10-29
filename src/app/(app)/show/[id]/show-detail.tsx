'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleEpisode, upsertUserShow, toggleShowNotif, markEpisodesWatchedBatch, removeUserShow, markShowAllWatched, unmarkShowAllWatched } from '@/lib/actions/shows';
import type { WatchStatus } from '@prisma/client';
import { ShowHero } from './show-hero';
import { SeasonList } from './season-list';
import { ProgressCard, RatingCard, NextEpisodeCard } from './progress-cards';
import { InfoCard, RelationsCard, FollowersCard } from './info-cards';
import type { ShowProps, SeasonProps, NextEpProps, FollowerProps, RelationItem } from './show-detail-types';

interface Props {
  show: ShowProps;
  seasons: SeasonProps[];
  nextEp: NextEpProps | null;
  userStatus: WatchStatus | null;
  notifyEnabled: boolean;
  userRating: number | null;
  followers: FollowerProps[];
  relations: RelationItem[];
}

export function ShowDetail({ show, seasons, nextEp, userStatus, notifyEnabled: initialNotify, userRating, followers, relations }: Props) {
  const router = useRouter();
  const [watched, setWatched] = useState<Set<string>>(
    () => new Set(seasons.flatMap(s => s.episodes.filter(e => e.watched).map(e => e.id)))
  );
  const [isPending, startTransition] = useTransition();
  const [notifyEnabled, setNotifyEnabled] = useState(initialNotify);

  const isAnime = show.type === 'ANIME';

  const addWatched = (ids: string[]) =>
    setWatched(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; });

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

  const handleRemove = () => {
    startTransition(() => removeUserShow(show.id));
    router.push('/dashboard');
  };

  const handleMarkAllWatched = () => {
    addWatched(seasons.flatMap(s => s.episodes.filter(e => e.hasAired).map(e => e.id)));
    startTransition(() => markShowAllWatched(show.id));
  };

  const handleUnmarkAllWatched = () => {
    setWatched(new Set());
    startTransition(() => unmarkShowAllWatched(show.id));
    router.refresh();
  };

  const handleMarkWatched = (episodeIds: string[]) => {
    addWatched(episodeIds);
    startTransition(() => markEpisodesWatchedBatch(episodeIds));
  };

  const totalWatched = seasons.reduce((a, s) => a + s.episodes.filter(e => watched.has(e.id)).length, 0);
  const totalEps = seasons.reduce((a, s) => a + s.episodeCount, 0);
  const hasUnwatchedAired = seasons.some(s => s.episodes.some(e => e.hasAired && !watched.has(e.id)));

  return (
    <div className={`page ${isAnime ? 'anime-detail' : ''}`}>
      <ShowHero
        show={show}
        isAnime={isAnime}
        userStatus={userStatus}
        totalEps={totalEps}
        notifyEnabled={notifyEnabled}
        isPending={isPending}
        onStatusChange={handleStatus}
        onToggleNotify={handleToggleNotify}
        onRemove={handleRemove}
      />

      <div className="detail-body">
        <div>
          {/* Synopsis */}
          {show.overview && (
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', fontWeight: 600, margin: '0 0 10px' }}>Synopsis</h3>
              <p className="synopsis">{show.overview}</p>
            </div>
          )}

          <SeasonList
            seasons={seasons}
            watched={watched}
            isAnime={isAnime}
            onToggleEpisode={handleToggleEp}
            onMarkWatched={handleMarkWatched}
          />
        </div>

        {/* ── Sidebar droite ───────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ProgressCard
            totalWatched={totalWatched}
            totalEps={totalEps}
            runtime={show.runtime}
            hasUnwatchedAired={hasUnwatchedAired}
            isPending={isPending}
            onMarkAll={handleMarkAllWatched}
            onUnmarkAll={handleUnmarkAllWatched}
          />
          {userStatus && <RatingCard showId={show.id} initialRating={userRating} />}
          {nextEp && (
            <NextEpisodeCard
              nextEp={nextEp}
              isAnime={isAnime}
              isWatched={watched.has(nextEp.id)}
              isPending={isPending}
              onToggle={() => handleToggleEp(nextEp.id)}
            />
          )}
          <InfoCard show={show} isAnime={isAnime} />
          <RelationsCard showId={show.id} relations={relations} />
          {followers.length > 0 && <FollowersCard followers={followers} />}
        </div>
      </div>
    </div>
  );
}
