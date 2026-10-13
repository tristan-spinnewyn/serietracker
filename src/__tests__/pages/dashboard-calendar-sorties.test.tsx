// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const {
  mockAuth,
  mockUserShowFindMany,
  mockEpisodeFindMany,
  mockUserEpisodeFindMany,
  mockApiFetch,
  mockToggleShowNotif,
  mockUpsertUserShow,
  mockPush,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockUserShowFindMany: vi.fn(),
  mockEpisodeFindMany: vi.fn(),
  mockUserEpisodeFindMany: vi.fn(),
  mockApiFetch: vi.fn(),
  mockToggleShowNotif: vi.fn(),
  mockUpsertUserShow: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/dashboard',
}));
vi.mock('@/lib/db', () => ({
  db: {
    userShow: { findMany: mockUserShowFindMany },
    episode: { findMany: mockEpisodeFindMany },
    userEpisode: { findMany: mockUserEpisodeFindMany },
  },
}));
vi.mock('@/lib/fetch', () => ({
  apiFetch: mockApiFetch,
}));
vi.mock('@/lib/actions/shows', () => ({
  toggleShowNotif: mockToggleShowNotif,
  upsertUserShow: mockUpsertUserShow,
}));

import DashboardPage from '@/app/(app)/dashboard/page';
import CalendarPage from '@/app/(app)/calendar/page';
import SortiesPage from '@/app/(app)/sorties/page';

describe('Dashboard, Calendar & Sorties Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'u1', name: 'Léa' } });
  });

  describe('DashboardPage', () => {
    it('affiche le dashboard avec salutations, shows en cours, à voir et activité', async () => {
      // watchingRows
      mockUserShowFindMany.mockResolvedValueOnce([
        {
          id: 'us1',
          show: {
            id: 's1',
            title: 'Le Dernier Train',
            type: 'SERIES',
            genre: 'Drame',
            posterPath: '/train.jpg',
            seasons: [{ episodes: [{ id: 'ep1', number: 1, title: 'E1', airDate: new Date() }] }],
          },
        },
      ]);
      // planRows
      mockUserShowFindMany.mockResolvedValueOnce([
        {
          id: 'us2',
          show: {
            id: 's2',
            title: 'Marina Eclipse',
            type: 'ANIME',
            genre: 'Action',
            year: 2025,
            posterPath: '/marina.jpg',
          },
        },
      ]);
      // upcomingEps
      mockEpisodeFindMany.mockResolvedValueOnce([
        {
          id: 'ep-up',
          number: 5,
          title: 'Sous la cendre',
          airDate: new Date(),
          season: {
            number: 3,
            show: {
              id: 's1',
              title: 'Le Dernier Train',
              type: 'SERIES',
            },
          },
        },
      ]);
      // recentActivity (call 1 in Promise.all)
      mockUserEpisodeFindMany.mockResolvedValueOnce([
        {
          id: 'ue1',
          watchedAt: new Date(),
          user: { name: 'Thomas', color: '#ff0000', initials: 'T' },
          episode: {
            number: 4,
            season: {
              number: 4,
              show: {
                id: 's3',
                title: 'Verre Brisé',
                type: 'SERIES',
                posterPath: '/v.jpg',
              },
            },
          },
        },
      ]);
      // watchedIds (call 2 after Promise.all)
      mockUserEpisodeFindMany.mockResolvedValueOnce([]);

      const jsx = await DashboardPage();
      render(jsx);

      expect(screen.getByText(/Continuer à regarder/)).toBeDefined();
      expect(screen.getAllByText('Le Dernier Train').length).toBeGreaterThan(0);
      expect(screen.getByText('Marina Eclipse')).toBeDefined();
      expect(screen.getByText(/Sous la cendre/)).toBeDefined();
      expect(screen.getByText('Thomas')).toBeDefined();
    });
  });

  describe('CalendarPage', () => {
    it('charge les épisodes de l\'API calendar et permet de changer de vue/mois', async () => {
      mockApiFetch.mockResolvedValue({
        episodes: [
          {
            id: 'cal-1',
            showId: 's1',
            showTitle: 'Arcane',
            showType: 'SERIES',
            seasonNumber: 2,
            episodeNumber: 1,
            airDate: new Date().toISOString(),
            notifyEnabled: true,
          },
        ],
      });

      render(<CalendarPage />);

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalled();
        expect(screen.getByText('Arcane')).toBeDefined();
      });

      // Basculer en vue liste
      const listBtn = screen.getByRole('button', { name: 'Liste' });
      fireEvent.click(listBtn);
      expect(screen.getByText(/S2 · E1/)).toBeDefined();

      // Clic sur la cloche de notification
      const bellBtn = screen.getByTitle(/Désactiver les notifications/i);
      fireEvent.click(bellBtn);
      expect(mockToggleShowNotif).toHaveBeenCalledWith('s1', false);

      // Basculer filtres et scope
      fireEvent.click(screen.getByRole('button', { name: 'Séries' }));
      fireEvent.click(screen.getByRole('button', { name: 'Global' }));

      // Changer de mois
      const nextBtn = screen.getAllByRole('button').filter(b => b.classList.contains('btn-icon-only'))[1];
      fireEvent.click(nextBtn);
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalled();
      });
    });

    it('affiche une erreur si le chargement du calendrier échoue', async () => {
      mockApiFetch.mockRejectedValue(new Error('Network error'));
      render(<CalendarPage />);
      await waitFor(() => {
        expect(screen.getByText('Impossible de charger le calendrier.')).toBeDefined();
      });
    });
  });

  describe('SortiesPage', () => {
    it('affiche les sorties films, séries et animes et gère les filtres et imports', async () => {
      mockApiFetch.mockResolvedValue({
        movies: [
          {
            id: 'm1',
            title: 'Dune 2',
            type: 'MOVIE',
            score: 8.5,
            status: 'En salles',
            posterUrl: '/dune.jpg',
            releaseDate: '2024-03-01',
            localId: null,
            userHasShow: false,
          },
        ],
        series: [
          {
            id: 'ser1',
            title: 'The Boys',
            type: 'SERIES',
            score: 8.2,
            status: 'En cours',
            posterUrl: '/boys.jpg',
            releaseDate: '2024-06-13',
            localId: 'local-boys',
            userHasShow: false,
            tmdbId: 76479,
          },
        ],
        anime: [
          {
            id: 'a1',
            title: 'Demon Slayer',
            type: 'ANIME',
            score: 8.9,
            status: 'En cours',
            posterUrl: '/ds.jpg',
            releaseDate: '2024-05-12',
            nextAiringDate: new Date(Date.now() + 86400000).toISOString(),
            nextAiringEpisode: 5,
            localId: null,
            userHasShow: false,
            anilistId: 101922,
          },
        ],
      });

      render(<SortiesPage />);

      await waitFor(() => {
        expect(screen.getByText('Dune 2')).toBeDefined();
        expect(screen.getByText('The Boys')).toBeDefined();
        expect(screen.getByText('Demon Slayer')).toBeDefined();
      });

      // Clic "À regarder" sur un show local (The Boys)
      mockUpsertUserShow.mockResolvedValue({ success: true });
      const addToListBtn = screen.getByRole('button', { name: /À regarder/i });
      fireEvent.click(addToListBtn);
      await waitFor(() => {
        expect(mockUpsertUserShow).toHaveBeenCalledWith({ showId: 'local-boys', status: 'PLAN_TO_WATCH' });
      });

      // Clic "Suivre" sur un anime non encore importé
      mockApiFetch.mockResolvedValueOnce({ id: 'imported-ds' });
      const followBtn = screen.getByRole('button', { name: /Suivre/i });
      fireEvent.click(followBtn);
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          '/api/shows/import',
          expect.objectContaining({ method: 'POST' })
        );
      });

      // Filtrer sur Films
      const filmsTab = screen.getByRole('button', { name: /Films/ });
      fireEvent.click(filmsTab);

      await waitFor(() => {
        expect(screen.getByText('Dune 2')).toBeDefined();
        expect(screen.queryByText('The Boys')).toBeNull();
      });
    });

    it('affiche un message d\'erreur si le chargement échoue', async () => {
      mockApiFetch.mockRejectedValue(new Error('Erreur API'));
      render(<SortiesPage />);
      await waitFor(() => {
        expect(screen.getByText(/Erreur API/)).toBeDefined();
      });
    });
  });
});
