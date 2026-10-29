import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  episode: { findMany: vi.fn(), count: vi.fn() },
  show: { findUnique: vi.fn() },
  userShow: { findUnique: vi.fn(), update: vi.fn() },
  userEpisode: { count: vi.fn() },
  notification: { findFirst: vi.fn(), create: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ db }));

import { completeFinishedShows, notifyCompletedSeasons } from '@/lib/services/watch-progress';

describe('completeFinishedShows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.episode.findMany.mockResolvedValue([{ season: { showId: 's1' } }, { season: { showId: 's1' } }]);
  });

  it('marks an ended show as completed once every episode is watched, and returns it', async () => {
    db.show.findUnique.mockResolvedValue({ status: 'ENDED' });
    db.userShow.findUnique.mockResolvedValue({ status: 'WATCHING' });
    db.episode.count.mockResolvedValue(12);
    db.userEpisode.count.mockResolvedValue(12);

    await expect(completeFinishedShows('u1', ['e1', 'e2'])).resolves.toEqual(['s1']);
    expect(db.userShow.update).toHaveBeenCalledWith({
      where: { userId_showId: { userId: 'u1', showId: 's1' } },
      data: { status: 'COMPLETED' },
    });
  });

  it.each([
    ['the show is still airing', 'RETURNING', 'WATCHING', 12],
    ['the user dropped it', 'ENDED', 'DROPPED', 12],
    ['episodes remain', 'ENDED', 'WATCHING', 11],
  ])('leaves the show untouched when %s', async (_label, showStatus, userStatus, watched) => {
    db.show.findUnique.mockResolvedValue({ status: showStatus });
    db.userShow.findUnique.mockResolvedValue({ status: userStatus });
    db.episode.count.mockResolvedValue(12);
    db.userEpisode.count.mockResolvedValue(watched);

    await expect(completeFinishedShows('u1', ['e1'])).resolves.toEqual([]);
    expect(db.userShow.update).not.toHaveBeenCalled();
  });
});

describe('notifyCompletedSeasons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.episode.findMany.mockResolvedValue([{
      seasonId: 'se1',
      season: { id: 'se1', number: 2, showId: 's1', show: { title: 'Frieren' }, episodes: [{ id: 'e1' }, { id: 'e2' }] },
    }]);
  });

  it('does nothing without episodes', async () => {
    await notifyCompletedSeasons('u1', []);
    expect(db.episode.findMany).not.toHaveBeenCalled();
  });

  it('creates a SEASON_COMPLETE notification once the whole season is watched', async () => {
    db.userEpisode.count.mockResolvedValue(2);
    db.notification.findFirst.mockResolvedValue(null);

    await notifyCompletedSeasons('u1', ['e2']);
    expect(db.notification.create).toHaveBeenCalledWith({
      data: { userId: 'u1', type: 'SEASON_COMPLETE', title: 'Frieren', body: 'Tu as terminé la saison 2 !', showId: 's1' },
    });
  });

  it('does not notify twice within a week', async () => {
    db.userEpisode.count.mockResolvedValue(2);
    db.notification.findFirst.mockResolvedValue({ id: 'n1' });

    await notifyCompletedSeasons('u1', ['e2']);
    expect(db.notification.create).not.toHaveBeenCalled();
  });
});
