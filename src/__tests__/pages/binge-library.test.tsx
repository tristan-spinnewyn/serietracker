// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const {
  mockAuth,
  mockUserShowFindMany,
  mockShowFindMany,
  mockUserEpisodeFindMany,
  mockEpisodeFindMany,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockUserShowFindMany: vi.fn(),
  mockShowFindMany: vi.fn(),
  mockUserEpisodeFindMany: vi.fn(),
  mockEpisodeFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    userShow: { findMany: mockUserShowFindMany },
    show: { findMany: mockShowFindMany },
    userEpisode: { findMany: mockUserEpisodeFindMany },
    episode: { findMany: mockEpisodeFindMany },
  },
}));

import BingePage from '@/app/(app)/binge/page';
import LibraryPage from '@/app/(app)/library/page';

describe('Binge & Library Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
  });

  describe('BingePage', () => {
    it('affiche la page Binge avec sections de rattrapage et découverte', async () => {
      // followingRows
      mockUserShowFindMany.mockResolvedValueOnce([
        {
          id: 'us1',
          show: {
            id: 's1',
            title: 'Marina Eclipse',
            type: 'ANIME',
            status: 'ENDED',
            tmdbId: null,
            anilistId: 5,
            posterPath: '/m.jpg',
            seasons: [{ episodes: [{ id: 'ep1' }, { id: 'ep2' }] }],
          },
        },
      ]);
      // followingSeriesRows
      mockUserShowFindMany.mockResolvedValueOnce([
        {
          id: 'us2',
          show: {
            id: 's2',
            title: 'Verre Brisé',
            type: 'SERIES',
            status: 'ENDED',
            tmdbId: 10,
            anilistId: null,
            posterPath: '/v.jpg',
            seasons: [{ episodes: [{ id: 'ep3' }] }],
          },
        },
      ]);
      // watchedEps
      mockUserEpisodeFindMany.mockResolvedValueOnce([{ episodeId: 'ep1' }]);
      // discoverShows
      mockShowFindMany.mockResolvedValueOnce([
        {
          id: 'disc1',
          title: 'Cyberpunk',
          type: 'ANIME',
          status: 'ENDED',
          tmdbId: null,
          anilistId: 8,
          posterPath: '/c.jpg',
          providers: ['netflix'],
          seasons: [{ _count: { episodes: 10 } }],
        },
      ]);
      // discoverSeriesShows
      mockShowFindMany.mockResolvedValueOnce([]);

      const jsx = await BingePage();
      render(jsx);

      expect(screen.getByText('Diffusion terminée')).toBeDefined();
      expect(screen.getAllByText('Marina Eclipse').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Verre Brisé').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Cyberpunk').length).toBeGreaterThan(0);
    });

    it('affiche l\'état sans séries à rattraper si les listes sont vides', async () => {
      mockUserShowFindMany.mockResolvedValueOnce([]);
      mockUserShowFindMany.mockResolvedValueOnce([]);
      mockUserEpisodeFindMany.mockResolvedValueOnce([]);
      mockShowFindMany.mockResolvedValueOnce([]);
      mockShowFindMany.mockResolvedValueOnce([]);

      const jsx = await BingePage();
      render(jsx);
      expect(screen.getByText("Rien de terminé pour l'instant")).toBeDefined();
    });
  });

  describe('LibraryPage', () => {
    it('affiche les onglets de statut, les filtres et les shows de la bibliothèque', async () => {
      mockUserShowFindMany.mockResolvedValue([
        {
          id: 'us1',
          status: 'WATCHING',
          show: {
            id: 's1',
            title: 'Re:Zero',
            type: 'ANIME',
            genre: 'Isekai',
            tmdbId: null,
            anilistId: 20,
            posterPath: '/rz.jpg',
            seasons: [{ _count: { episodes: 25 } }],
          },
        },
      ]);
      mockEpisodeFindMany.mockResolvedValue([{ id: 'ep-x', season: { showId: 's1' } }]);
      mockUserEpisodeFindMany.mockResolvedValue([{ episodeId: 'ep-x' }]);

      const jsx = await LibraryPage({
        searchParams: Promise.resolve({ status: 'WATCHING', type: 'ANIME' }),
      });
      render(jsx);

      expect(screen.getByText('Bibliothèque')).toBeDefined();
      expect(screen.getAllByText('Re:Zero').length).toBeGreaterThan(0);
    });

    it('affiche l\'état vide quand aucun show ne correspond aux filtres', async () => {
      mockUserShowFindMany.mockResolvedValue([]);
      mockEpisodeFindMany.mockResolvedValue([]);
      mockUserEpisodeFindMany.mockResolvedValue([]);

      const jsx = await LibraryPage({ searchParams: Promise.resolve({}) });
      render(jsx);
      expect(screen.getByText('Aucun show')).toBeDefined();
    });
  });
});
