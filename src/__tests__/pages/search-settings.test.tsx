// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const {
  mockAuth,
  mockApiFetch,
  mockPush,
  mockRedirect,
  mockUserFindUniqueOrThrow,
  mockUserEpisodeFindMany,
  mockUserShowFindMany,
  mockUpdateProfile,
  mockUpdatePassword,
  mockUpdatePlatforms,
  mockSyncFromAnilist,
  mockSignOut,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockApiFetch: vi.fn(),
  mockPush: vi.fn(),
  mockRedirect: vi.fn(),
  mockUserFindUniqueOrThrow: vi.fn(),
  mockUserEpisodeFindMany: vi.fn(),
  mockUserShowFindMany: vi.fn(),
  mockUpdateProfile: vi.fn(),
  mockUpdatePassword: vi.fn(),
  mockUpdatePlatforms: vi.fn(),
  mockSyncFromAnilist: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('next-auth/react', () => ({ signOut: mockSignOut }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  redirect: mockRedirect,
}));
vi.mock('@/lib/db', () => ({
  db: {
    user: { findUniqueOrThrow: mockUserFindUniqueOrThrow },
    userEpisode: { findMany: mockUserEpisodeFindMany },
    userShow: { findMany: mockUserShowFindMany },
  },
}));
vi.mock('@/lib/fetch', () => ({
  apiFetch: mockApiFetch,
}));
vi.mock('@/lib/actions/settings', () => ({
  updateProfile: mockUpdateProfile,
  updatePassword: mockUpdatePassword,
  updatePlatforms: mockUpdatePlatforms,
}));
vi.mock('@/lib/actions/anilist-sync', () => ({
  syncFromAnilist: mockSyncFromAnilist,
}));

import SearchPage from '@/app/(app)/search/page';
import SettingsPage from '@/app/(app)/settings/page';
import { SettingsClient } from '@/app/(app)/settings/settings-client';

describe('Search & Settings Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'u1', name: 'Léa' } });
  });

  describe('SearchPage', () => {
    it('shows the API error and re-enables the card when an import fails', async () => {
      mockApiFetch.mockImplementation(async (url: string) => {
        if (url === '/api/shows/import') throw new Error("Trop d'imports, réessaie dans une minute.");
        return { local: [], remote: [{ tmdbId: 100, title: 'Archer', type: 'SERIES', year: 2009, posterPath: null }] };
      });

      render(<SearchPage />);
      fireEvent.change(screen.getByPlaceholderText('Titre, studio, acteur…'), { target: { value: 'Arc' } });
      await waitFor(() => expect(screen.getByText('Archer')).toBeDefined());

      fireEvent.click(screen.getByText('Archer'));

      await waitFor(() => {
        expect(screen.getByText(/Trop d'imports, réessaie dans une minute\./)).toBeDefined();
      });
      expect(screen.getByText('Archer').closest('button')?.disabled).toBe(false);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('permet de taper une recherche et affiche les résultats locaux et distants', async () => {
      mockApiFetch.mockResolvedValue({
        local: [
          { id: 's1', title: 'Arcane', type: 'SERIES', year: 2021, providers: ['netflix'], userShows: [] },
        ],
        remote: [
          { tmdbId: 100, title: 'Archer', type: 'SERIES', year: 2009, posterPath: null },
        ],
      });
      render(<SearchPage />);
      const input = screen.getByPlaceholderText('Titre, studio, acteur…');
      fireEvent.change(input, { target: { value: 'Arc' } });

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalled();
        expect(screen.getByText('Arcane')).toBeDefined();
        expect(screen.getByText('Archer')).toBeDefined();
      });

      // Import d'un résultat distant
      fireEvent.click(screen.getByText('Archer'));

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          '/api/shows/import',
          expect.objectContaining({ method: 'POST' })
        );
      });

      // Bouton Effacer
      const clearBtn = screen.getByRole('button', { name: 'Effacer' });
      fireEvent.click(clearBtn);
      expect(screen.queryByText('Arcane')).toBeNull();

      // Filtres
      fireEvent.click(screen.getByRole('button', { name: 'Séries' }));
      fireEvent.click(screen.getByRole('button', { name: /Mes plateformes/i }));
    });

    it('only offers genre and season filters once the anime type is picked', () => {
      render(<SearchPage />);
      expect(screen.queryByLabelText('Genre')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Animes' }));

      expect(screen.getByLabelText('Genre')).toBeDefined();
      expect(screen.getByLabelText('Saison')).toBeDefined();
      expect(screen.getByLabelText('Année')).toBeDefined();
    });

    it('browses anime by genre, season and year without typing a title', async () => {
      mockApiFetch.mockResolvedValue({
        local: [],
        remote: [{ anilistId: 9, title: 'Fall Hit', type: 'ANIME', year: 2026, posterPath: null }],
      });
      render(<SearchPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Animes' }));

      fireEvent.change(screen.getByLabelText('Genre'), { target: { value: 'Action' } });
      fireEvent.change(screen.getByLabelText('Saison'), { target: { value: 'FALL' } });
      fireEvent.change(screen.getByLabelText('Année'), { target: { value: '2026' } });

      await waitFor(() => expect(screen.getByText('Fall Hit')).toBeDefined());
      expect(mockApiFetch).toHaveBeenLastCalledWith(
        '/api/shows/search?q=&type=ANIME&genre=Action&season=FALL&seasonYear=2026',
      );
      expect(screen.queryByText(/Tape au moins 2 caractères/)).toBeNull();
    });

    it('drops the anime filters when switching back to series', async () => {
      mockApiFetch.mockResolvedValue({ local: [], remote: [] });
      render(<SearchPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Animes' }));
      fireEvent.change(screen.getByLabelText('Genre'), { target: { value: 'Drama' } });
      await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());

      fireEvent.click(screen.getByRole('button', { name: 'Séries' }));

      expect(screen.queryByLabelText('Genre')).toBeNull();
      expect(screen.getByText(/Tape au moins 2 caractères/)).toBeDefined();
    });

    it('affiche un message d\'erreur si la recherche échoue', async () => {
      mockApiFetch.mockRejectedValue(new Error('Erreur réseau'));
      render(<SearchPage />);
      const input = screen.getByPlaceholderText('Titre, studio, acteur…');
      fireEvent.change(input, { target: { value: 'Crash' } });

      await waitFor(() => {
        expect(screen.getByText('Impossible de lancer la recherche.')).toBeDefined();
      });
    });
  });

  describe('SettingsPage', () => {
    it('calcule les statistiques et rend le composant SettingsClient', async () => {
      mockUserFindUniqueOrThrow.mockResolvedValue({
        id: 'u1',
        name: 'Léa',
        email: 'lea@example.com',
        color: '#A855F7',
        initials: 'L',
        platforms: ['netflix', 'crunchyroll'],
        createdAt: new Date('2024-01-01'),
      });
      mockUserEpisodeFindMany.mockResolvedValue([
        { episode: { runtime: 50, season: { show: { runtime: 50 } } } },
      ]);
      mockUserShowFindMany.mockResolvedValue([
        { status: 'WATCHING', rating: 4.5, show: { genre: 'Drame, Sci-Fi' } },
      ]);

      const jsx = await SettingsPage();
      render(jsx);

      expect(screen.getByText('Paramètres')).toBeDefined();
      expect(screen.getByDisplayValue('Léa')).toBeDefined();
      expect(screen.getByText('lea@example.com')).toBeDefined();
    });
  });

  describe('SettingsClient', () => {
    const mockUser = {
      id: 'u1',
      name: 'Léa',
      email: 'lea@example.com',
      color: '#A855F7',
      initials: 'L',
      platforms: ['netflix'],
    };
    const mockStats = {
      totalEpisodes: 42,
      totalMinutes: 2100,
      showsByStatus: { WATCHING: 3, COMPLETED: 5 },
      avgRating: 4.2,
      topGenres: [{ genre: 'Drame', count: 3 }],
      memberSince: '2024-01-01T00:00:00.000Z',
    };

    it('permet de changer de nom et de couleur', async () => {
      mockUpdateProfile.mockResolvedValue({ success: true });
      render(<SettingsClient user={mockUser} stats={mockStats} vapidPublicKey="" />);

      const nameInput = screen.getByDisplayValue('Léa');
      fireEvent.change(nameInput, { target: { value: 'Léa Nouvelle' } });

      const saveBtn = screen.getByRole('button', { name: /Sauvegarder$/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ name: 'Léa Nouvelle' }));
      });
    });

    it('permet de modifier le mot de passe', async () => {
      mockUpdatePassword.mockResolvedValue({ success: true });
      render(<SettingsClient user={mockUser} stats={mockStats} vapidPublicKey="" />);

      const inputs = screen.getAllByPlaceholderText('••••••••');
      const currentInput = inputs[0];
      const nextInput = screen.getByPlaceholderText('8 caractères minimum');
      const confInput = inputs[1];

      fireEvent.change(currentInput, { target: { value: 'oldpass123' } });
      fireEvent.change(nextInput, { target: { value: 'newpass123' } });
      fireEvent.change(confInput, { target: { value: 'newpass123' } });

      const changePwBtn = screen.getByRole('button', { name: /Changer le mot de passe/i });
      fireEvent.click(changePwBtn);

      await waitFor(() => {
        expect(mockUpdatePassword).toHaveBeenCalledWith({ current: 'oldpass123', next: 'newpass123' });
        // The change revokes every session, the current one included
        expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/login?passwordChanged=1' });
      });
    });

    it('permet de synchroniser un compte AniList', async () => {
      mockSyncFromAnilist.mockResolvedValue({ status: 'ok', imported: 3, skipped: 1, errors: 0 });
      render(<SettingsClient user={mockUser} stats={mockStats} vapidPublicKey="" />);

      const usernameInput = screen.getByPlaceholderText('Ton pseudo AniList');
      fireEvent.change(usernameInput, { target: { value: 'otaku_user' } });

      const syncBtn = screen.getByRole('button', { name: /Importer/i });
      fireEvent.click(syncBtn);

      await waitFor(() => {
        expect(mockSyncFromAnilist).toHaveBeenCalledWith('otaku_user');
        expect(screen.getByText(/3 shows importés/)).toBeDefined();
      });
    });

    it('permet de basculer une plateforme de streaming', async () => {
      mockUpdatePlatforms.mockResolvedValue({ success: true });
      render(<SettingsClient user={mockUser} stats={mockStats} vapidPublicKey="" />);

      const crunchyrollBtn = screen.getByRole('button', { name: /Crunchyroll/i });
      fireEvent.click(crunchyrollBtn);

      const savePlatBtn = screen.getByRole('button', { name: /Sauvegarder les plateformes/i });
      fireEvent.click(savePlatBtn);

      await waitFor(() => {
        expect(mockUpdatePlatforms).toHaveBeenCalled();
      });
    });

    it('affiche une erreur si les mots de passe ne correspondent pas', async () => {
      render(<SettingsClient user={mockUser} stats={mockStats} vapidPublicKey="" />);

      const inputs = screen.getAllByPlaceholderText('••••••••');
      const currentInput = inputs[0];
      const nextInput = screen.getByPlaceholderText('8 caractères minimum');
      const confInput = inputs[1];

      fireEvent.change(currentInput, { target: { value: 'oldpass123' } });
      fireEvent.change(nextInput, { target: { value: 'passwordA' } });
      fireEvent.change(confInput, { target: { value: 'passwordB' } });

      const changePwBtn = screen.getByRole('button', { name: /Changer le mot de passe/i });
      fireEvent.click(changePwBtn);

      expect(screen.getByText(/Les mots de passe ne correspondent pas/)).toBeDefined();
    });

    it('gère les erreurs de synchronisation AniList', async () => {
      mockSyncFromAnilist.mockResolvedValueOnce({ status: 'not_found' });
      render(<SettingsClient user={mockUser} stats={mockStats} vapidPublicKey="" />);

      const usernameInput = screen.getByPlaceholderText('Ton pseudo AniList');
      fireEvent.change(usernameInput, { target: { value: 'unknown_user' } });

      const syncBtn = screen.getByRole('button', { name: /Importer/i });
      fireEvent.click(syncBtn);

      await waitFor(() => {
        expect(screen.getByText(/Utilisateur AniList introuvable/)).toBeDefined();
      });
    });

    it('tells the user to wait when AniList syncs are rate limited', async () => {
      mockSyncFromAnilist.mockResolvedValueOnce({ status: 'rate_limited' });
      render(<SettingsClient user={mockUser} stats={mockStats} vapidPublicKey="" />);

      fireEvent.change(screen.getByPlaceholderText('Ton pseudo AniList'), { target: { value: 'otaku' } });
      fireEvent.click(screen.getByRole('button', { name: /Importer/i }));

      await waitFor(() => {
        expect(screen.getByText(/Trop d'imports AniList/)).toBeDefined();
      });
    });
  });
});
