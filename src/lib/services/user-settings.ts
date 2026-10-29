import { db } from '@/lib/db';

/** The user's profile (without createdAt) and their viewing statistics for the settings page. */
export async function getUserSettings(userId: string) {
  const [user, watchedEps, allUserShows] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true, color: true, initials: true, platforms: true, createdAt: true },
    }),
    db.userEpisode.findMany({
      where: { userId },
      select: {
        episode: {
          select: {
            runtime: true,
            season: { select: { show: { select: { runtime: true } } } },
          },
        },
      },
    }),
    db.userShow.findMany({
      where: { userId },
      select: { status: true, rating: true, show: { select: { genre: true } } },
    }),
  ]);

  const totalMinutes = watchedEps.reduce((sum, ue) => {
    return sum + (ue.episode.runtime ?? ue.episode.season.show.runtime ?? 0);
  }, 0);

  const showsByStatus: Record<string, number> = {};
  const ratings: number[] = [];
  const genreCount: Record<string, number> = {};

  for (const us of allUserShows) {
    showsByStatus[us.status] = (showsByStatus[us.status] ?? 0) + 1;
    if (us.rating != null) ratings.push(us.rating);
    if (us.show.genre) {
      for (const g of us.show.genre.split(',').map(s => s.trim()).filter(Boolean)) {
        genreCount[g] = (genreCount[g] ?? 0) + 1;
      }
    }
  }

  const stats = {
    totalEpisodes: watchedEps.length,
    totalMinutes,
    showsByStatus,
    avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    topGenres: Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([genre, count]) => ({ genre, count })),
    memberSince: user.createdAt.toISOString(),
  };

  const { createdAt: _createdAt, ...profile } = user;
  return { user: profile, stats };
}
