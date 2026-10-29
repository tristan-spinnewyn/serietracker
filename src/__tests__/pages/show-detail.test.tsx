// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const {
  mockAuth,
  mockNotFound,
  mockShowFindUnique,
  mockUserEpisodeFindMany,
  mockPush,
  mockRefresh,
  mockApiFetch,
  mockToggleEpisode,
  mockUpsertUserShow,
  mockToggleShowNotif,
  mockMarkEpisodesWatchedBatch,
  mockResyncShow,
  mockRemoveUserShow,
  mockRateShow,
  mockMarkShowAllWatched,
  mockUnmarkShowAllWatched,
  mockAddShowToList,
  mockLinkShows,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockNotFound: vi.fn(),
  mockShowFindUnique: vi.fn(),
  mockUserEpisodeFindMany: vi.fn(),
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockApiFetch: vi.fn(),
  mockToggleEpisode: vi.fn(),
  mockUpsertUserShow: vi.fn(),
  mockToggleShowNotif: vi.fn(),
  mockMarkEpisodesWatchedBatch: vi.fn(),
  mockResyncShow: vi.fn(),
  mockRemoveUserShow: vi.fn(),
  mockRateShow: vi.fn(),
  mockMarkShowAllWatched: vi.fn(),
  mockUnmarkShowAllWatched: vi.fn(),
  mockAddShowToList: vi.fn(),
  mockLinkShows: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    const err = new Error('NEXT_NOT_FOUND');
    (err as any).digest = 'NEXT_NOT_FOUND';
    throw err;
  }),
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));
vi.mock('@/lib/db', () => ({
  db: {
    show: { findUnique: mockShowFindUnique },
    userEpisode: { findMany: mockUserEpisodeFindMany },
  },
}));
vi.mock('@/lib/fetch', () => ({
  apiFetch: mockApiFetch,
}));
vi.mock('@/lib/actions/shows', () => ({
  toggleEpisode: mockToggleEpisode,
  upsertUserShow: mockUpsertUserShow,
  toggleShowNotif: mockToggleShowNotif,
  markEpisodesWatchedBatch: mockMarkEpisodesWatchedBatch,
  resyncShow: mockResyncShow,
  removeUserShow: mockRemoveUserShow,
  rateShow: mockRateShow,
  markShowAllWatched: mockMarkShowAllWatched,
  unmarkShowAllWatched: mockUnmarkShowAllWatched,
}));
vi.mock('@/lib/actions/lists', () => ({
  addShowToList: mockAddShowToList,
  linkShows: mockLinkShows,
}));

import ShowPage from '@/app/(app)/show/[id]/page';
import { ShowDetail } from '@/app/(app)/show/[id]/show-detail';

describe('Show Page & ShowDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe('ShowPage (Server Component)', () => {
    it('appelle notFound si la session est absente', async () => {
      mockAuth.mockResolvedValue(null);
      await expect(ShowPage({ params: Promise.resolve({ id: 's1' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('appelle notFound si le show est introuvable', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } });
      mockShowFindUnique.mockResolvedValue(null);
      await expect(ShowPage({ params: Promise.resolve({ id: 'nonexistent' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('rend le composant ShowDetail avec les données calculées', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', name: 'Léa' } });
      mockShowFindUnique.mockResolvedValue({
        id: 's1',
        title: 'Arcane',
        type: 'SERIES',
        status: 'RETURNING',
        year: 2021,
        overview: 'Deux soeurs dans les bas-fonds de Zaun.',
        posterPath: '/arcane.jpg',
        backdropPath: '/arcane-bg.jpg',
        tmdbId: 94605,
        anilistId: null,
        network: 'Netflix',
        genre: 'Animation, Sci-Fi',
        runtime: 40,
        totalSeasons: 2,
        providers: ['netflix'],
        providerLinks: { netflix: 'https://netflix.com' },
        seasons: [
          {
            id: 'season-1',
            number: 1,
            title: 'Saison 1',
            year: 2021,
            episodes: [
              { id: 'ep-1', number: 1, title: 'Le pont', runtime: 43, airDate: new Date('2021-11-06') },
              { id: 'ep-2', number: 2, title: 'Certains mystères', runtime: 40, airDate: new Date('2021-11-06') },
            ],
          },
        ],
        userShows: [
          {
            userId: 'u1',
            status: 'WATCHING',
            notifyEnabled: true,
            rating: 5,
            user: { id: 'u1', name: 'Léa', color: '#A855F7', initials: 'L' },
          },
          {
            userId: 'u2',
            status: 'COMPLETED',
            notifyEnabled: false,
            rating: 4,
            user: { id: 'u2', name: 'Thomas', color: '#34D399', initials: 'T' },
          },
        ],
        relationsFrom: [
          {
            type: 'SEQUEL',
            toShow: {
              id: 's2',
              title: 'Arcane Saison 2',
              type: 'SERIES',
              year: 2024,
              tmdbId: 94605,
              anilistId: null,
              posterPath: '/arcane2.jpg',
              status: 'RETURNING',
            },
          },
        ],
      });

      mockUserEpisodeFindMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      const jsx = await ShowPage({ params: Promise.resolve({ id: 's1' }) });
      render(jsx);

      expect(screen.getByText('Arcane')).toBeDefined();
      expect(screen.getByText('Deux soeurs dans les bas-fonds de Zaun.')).toBeDefined();
      expect(screen.getAllByText('Netflix').length).toBeGreaterThan(0);
      expect(screen.getByText('Thomas')).toBeDefined();
      expect(screen.getByText('Arcane Saison 2')).toBeDefined();
      // Not an admin: the shared relations cannot be edited
      expect(screen.queryByRole('button', { name: /Lier/i })).toBeNull();
    });
  });

  describe('ShowDetail (Client Component)', () => {
    const defaultProps = {
      show: {
        id: 's1',
        title: 'Frieren: Beyond Journey\'s End',
        type: 'ANIME',
        status: 'RETURNING',
        year: 2023,
        overview: 'Une elfe explore la vie après la fin de la quête.',
        posterUrl: 'https://example.com/frieren.jpg',
        backdropUrl: null,
        network: 'Madhouse',
        genre: 'Fantasy, Drame',
        runtime: 24,
        totalSeasons: 1,
        providers: ['crunchyroll'],
        providerLinks: { crunchyroll: 'https://crunchyroll.com' },
      },
      seasons: [
        {
          id: 'season-1',
          number: 1,
          title: 'Saison 1',
          year: 2023,
          episodeCount: 2,
          watchedCount: 1,
          episodes: [
            {
              id: 'ep-1',
              number: 1,
              title: 'La fin du voyage',
              runtime: '24 min',
              airDate: '29 sept.',
              watched: true,
              isNext: false,
              hasAired: true,
            },
            {
              id: 'ep-2',
              number: 2,
              title: 'Ce n\'était pas nécessaire',
              runtime: '24 min',
              airDate: '29 sept.',
              watched: false,
              isNext: true,
              hasAired: true,
            },
          ],
        },
      ],
      nextEp: {
        id: 'ep-2',
        seasonNumber: 1,
        episodeNumber: 2,
        title: 'Ce n\'était pas nécessaire',
        airDate: '29 septembre',
      },
      userStatus: 'WATCHING' as const,
      notifyEnabled: true,
      userRating: 5,
      followers: [
        {
          user: { id: 'u2', name: 'Thomas', color: '#34D399', initials: 'T' },
          status: 'COMPLETED',
        },
      ],
      relations: [],
      canEditRelations: true,
    };

    it('hides the link button from users who cannot edit relations', () => {
      render(<ShowDetail {...defaultProps} canEditRelations={false} />);
      expect(screen.queryByRole('button', { name: /Lier/i })).toBeNull();
    });

    it('permet de basculer l\'état vu d\'un épisode', async () => {
      mockToggleEpisode.mockResolvedValue({ success: true });
      render(<ShowDetail {...defaultProps} />);

      // Le deuxième épisode n'est pas vu, cliquons dessus (premier élément texte de la liste)
      const epRow = screen.getAllByText('Ce n\'était pas nécessaire')[0];
      fireEvent.click(epRow);

      await waitFor(() => {
        expect(mockToggleEpisode).toHaveBeenCalledWith('ep-2', true);
      });
    });

    it('permet de changer le statut de suivi', async () => {
      mockUpsertUserShow.mockResolvedValue({ success: true });
      render(<ShowDetail {...defaultProps} />);

      // Statut actuel: WATCHING -> clic change en PAUSED
      const statusBtn = screen.getByRole('button', { name: /En cours/i });
      fireEvent.click(statusBtn);

      await waitFor(() => {
        expect(mockUpsertUserShow).toHaveBeenCalledWith({ showId: 's1', status: 'PAUSED' });
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('permet de basculer les notifications', async () => {
      mockToggleShowNotif.mockResolvedValue({ success: true });
      render(<ShowDetail {...defaultProps} />);

      const notifBtn = screen.getByRole('button', { name: /Notifs on/i });
      fireEvent.click(notifBtn);

      await waitFor(() => {
        expect(mockToggleShowNotif).toHaveBeenCalledWith('s1', false);
      });
    });

    it('permet de noter la série', async () => {
      mockRateShow.mockResolvedValue({ success: true });
      render(<ShowDetail {...defaultProps} />);

      // Clic sur l'étoile 4
      const star4 = screen.getByTitle('4 étoiles');
      fireEvent.click(star4);

      await waitFor(() => {
        expect(mockRateShow).toHaveBeenCalledWith('s1', 4);
      });
    });

    it('permet de marquer tous les épisodes comme vus', async () => {
      mockMarkShowAllWatched.mockResolvedValue({ success: true });
      render(<ShowDetail {...defaultProps} />);

      const markAllBtn = screen.getByRole('button', { name: /Tout marquer comme vu/i });
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(mockMarkShowAllWatched).toHaveBeenCalledWith('s1');
      });

      // Après avoir tout marqué comme vu, le bouton inverse prend le relais
      expect(screen.queryByRole('button', { name: /Tout marquer comme vu/i })).toBeNull();
      expect(screen.getByRole('button', { name: /Tout marquer comme non vu/i })).toBeDefined();
    });

    it('permet de tout marquer comme non vu via le bouton inverse', async () => {
      mockUnmarkShowAllWatched.mockResolvedValue({ success: true });
      render(<ShowDetail {...defaultProps} />);

      // Le bouton inverse "Tout marquer comme non vu" est présent car un épisode est vu
      const unmarkBtn = screen.getByRole('button', { name: /Tout marquer comme non vu/i });
      fireEvent.click(unmarkBtn);

      await waitFor(() => {
        expect(mockUnmarkShowAllWatched).toHaveBeenCalledWith('s1');
        expect(mockRefresh).toHaveBeenCalled();
      });

      // Après avoir tout démarqué, "Tout marquer comme non vu" disparaît et "Tout marquer comme vu" réapparaît
      expect(screen.getByRole('button', { name: /Tout marquer comme vu/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /Tout marquer comme non vu/i })).toBeNull();
    });

    it('affiche uniquement le bouton inverse lorsque tous les épisodes sont vus', () => {
      const allWatchedProps = {
        ...defaultProps,
        seasons: [
          {
            ...defaultProps.seasons[0],
            watchedCount: 2,
            episodes: defaultProps.seasons[0].episodes.map(e => ({ ...e, watched: true })),
          },
        ],
      };
      render(<ShowDetail {...allWatchedProps} />);

      expect(screen.getByRole('button', { name: /Tout marquer comme non vu/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /Tout marquer comme vu/i })).toBeNull();
    });

    it('n\'affiche pas le bouton "Tout marquer comme non vu" si aucun épisode n\'est vu', () => {
      const zeroWatchedProps = {
        ...defaultProps,
        seasons: [
          {
            ...defaultProps.seasons[0],
            watchedCount: 0,
            episodes: defaultProps.seasons[0].episodes.map(e => ({ ...e, watched: false })),
          },
        ],
      };
      render(<ShowDetail {...zeroWatchedProps} />);

      expect(screen.getByRole('button', { name: /Tout marquer comme vu/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /Tout marquer comme non vu/i })).toBeNull();
    });

    it('permet de réimporter / synchroniser les données', async () => {
      mockResyncShow.mockResolvedValue({ success: true });
      render(<ShowDetail {...defaultProps} />);

      const resyncBtn = screen.getByRole('button', { name: /Réimporter/i });
      fireEvent.click(resyncBtn);

      await waitFor(() => {
        expect(mockResyncShow).toHaveBeenCalledWith('s1');
      });
    });

    it('permet de copier le lien dans le presse-papier', () => {
      render(<ShowDetail {...defaultProps} />);

      const shareBtn = screen.getByTitle(/Copier le lien/i);
      fireEvent.click(shareBtn);

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it('permet de retirer la série de sa liste', async () => {
      mockRemoveUserShow.mockResolvedValue({ success: true });
      render(<ShowDetail {...defaultProps} />);

      const removeBtn = screen.getByText('Retirer de ma liste');
      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(mockRemoveUserShow).toHaveBeenCalledWith('s1');
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('ouvre la modale pour ajouter à une liste et appelle addShowToList', async () => {
      mockApiFetch.mockResolvedValue({
        lists: [
          { id: 'l1', name: 'Coups de coeur', emoji: '❤️', color: '#EC4899', items: [] },
        ],
      });
      mockAddShowToList.mockResolvedValue({ success: true });

      render(<ShowDetail {...defaultProps} />);

      const listBtn = screen.getByRole('button', { name: /^Liste$/ });
      fireEvent.click(listBtn);

      await waitFor(() => {
        expect(screen.getByText('Ajouter à une liste')).toBeDefined();
        expect(screen.getByText('Coups de coeur')).toBeDefined();
      });

      const listItemBtn = screen.getByRole('button', { name: /Coups de coeur/i });
      fireEvent.click(listItemBtn);

      await waitFor(() => {
        expect(mockAddShowToList).toHaveBeenCalledWith('l1', 's1');
      });
    });

    it('ouvre la modale pour lier une œuvre et appelle linkShows', async () => {
      mockApiFetch.mockResolvedValue({
        local: [
          { id: 's2', title: 'Frieren Saison 2', type: 'ANIME', year: 2026, tmdbId: null, anilistId: 999, posterPath: null },
        ],
      });
      mockLinkShows.mockResolvedValue({ success: true });

      render(<ShowDetail {...defaultProps} />);

      const linkBtn = screen.getByRole('button', { name: /Lier/i });
      fireEvent.click(linkBtn);

      expect(screen.getByText('Lier une œuvre')).toBeDefined();

      const searchInput = screen.getByPlaceholderText('Chercher un show dans la bibliothèque…');
      fireEvent.change(searchInput, { target: { value: 'Frieren' } });

      await waitFor(() => {
        expect(screen.getByText('Frieren Saison 2')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Frieren Saison 2'));

      const modalContainer = screen.getByText('Lier une œuvre').closest('div[style*="width: 420px"]')!;
      const submitBtn = modalContainer.querySelector('button.violet') as HTMLButtonElement;

      await waitFor(() => {
        expect(submitBtn.disabled).toBe(false);
      });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockLinkShows).toHaveBeenCalledWith('s1', 's2', 'SEQUEL');
      });
    });

    it('permet de marquer les épisodes jusqu\'à un épisode donné', async () => {
      mockMarkEpisodesWatchedBatch.mockResolvedValue({ success: true });
      render(<ShowDetail {...defaultProps} />);

      // Ouvre le menu 'more' sur le deuxième épisode (qui n'est pas vu)
      const moreBtns = screen.getAllByRole('button').filter(b => b.classList.contains('more'));
      expect(moreBtns.length).toBeGreaterThan(1);
      fireEvent.click(moreBtns[1]);

      await waitFor(() => {
        expect(screen.getByText("Marquer jusqu'ici")).toBeDefined();
      });

      fireEvent.click(screen.getByText("Marquer jusqu'ici"));

      await waitFor(() => {
        expect(mockMarkEpisodesWatchedBatch).toHaveBeenCalledWith(['ep-2']);
      });
    });
  });
});
