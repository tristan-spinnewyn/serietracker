import { db } from '@/lib/db';

/** Episodes airing in a month for the user's shows (scope 'me') or everyone's. */
export async function getCalendarEpisodes(userId: string, y: number, m: number, scope: string) {
  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 1);

  const episodes = await db.episode.findMany({
    where: {
      airDate: { gte: start, lt: end },
      season: {
        show: {
          userShows: scope === 'me'
            ? { some: { userId: userId } }
            : { some: {} },
        },
      },
    },
    include: {
      season: {
        include: {
          show: {
            include: {
              userShows: { where: { userId: userId }, select: { notifyEnabled: true } },
            },
          },
        },
      },
    },
    orderBy: { airDate: 'asc' },
  });

  return {
    episodes: episodes.map(e => ({
      id: e.id,
      showId: e.season.show.id,
      showTitle: e.season.show.title,
      showType: e.season.show.type,
      seasonNumber: e.season.number,
      episodeNumber: e.number,
      airDate: e.airDate,
      notifyEnabled: e.season.show.userShows[0]?.notifyEnabled ?? true,
    })),
  };
}
