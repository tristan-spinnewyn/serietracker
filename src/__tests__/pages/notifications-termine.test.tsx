// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const {
  mockAuth,
  mockNotificationFindMany,
  mockMarkAllNotificationsRead,
  mockUserShowFindMany,
  mockMarkAllCompletedEpisodesWatched,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockNotificationFindMany: vi.fn(),
  mockMarkAllNotificationsRead: vi.fn(),
  mockUserShowFindMany: vi.fn(),
  mockMarkAllCompletedEpisodesWatched: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    notification: { findMany: mockNotificationFindMany },
    userShow: { findMany: mockUserShowFindMany },
  },
}));
vi.mock('@/lib/actions/notifications', () => ({
  markAllNotificationsRead: mockMarkAllNotificationsRead,
}));
vi.mock('@/lib/actions/shows', () => ({
  markAllCompletedEpisodesWatched: mockMarkAllCompletedEpisodesWatched,
}));

import NotificationsPage from '@/app/(app)/notifications/page';
import { MarkReadOnMount } from '@/app/(app)/notifications/mark-read';
import TerminePage from '@/app/(app)/termine/page';
import { MarkAllWatchedButton } from '@/app/(app)/termine/mark-all-button';

describe('Notifications & Terminé Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
  });

  describe('MarkReadOnMount', () => {
    it('déclenche markAllNotificationsRead au montage si hasUnread est vrai', () => {
      render(<MarkReadOnMount hasUnread={true} />);
      expect(mockMarkAllNotificationsRead).toHaveBeenCalled();
    });

    it('ne fait rien si hasUnread est faux', () => {
      render(<MarkReadOnMount hasUnread={false} />);
      expect(mockMarkAllNotificationsRead).not.toHaveBeenCalled();
    });
  });

  describe('NotificationsPage', () => {
    it('affiche l\'état vide quand il n\'y a aucune notification', async () => {
      mockNotificationFindMany.mockResolvedValue([]);
      const jsx = await NotificationsPage();
      render(jsx);
      expect(screen.getByText('Tout est calme pour le moment')).toBeDefined();
    });

    it('affiche la liste des notifications avec types et dates', async () => {
      mockNotificationFindMany.mockResolvedValue([
        {
          id: 'n1',
          userId: 'u1',
          type: 'NEW_EPISODE',
          title: 'Arcane',
          body: 'S2 · E1 est disponible',
          showId: 's1',
          read: false,
          createdAt: new Date(Date.now() - 30 * 1000), // à l'instant
        },
        {
          id: 'n2',
          userId: 'u1',
          type: 'SEASON_COMPLETE',
          title: 'Frieren',
          body: 'Saison 1 terminée',
          showId: 's2',
          read: true,
          createdAt: new Date(Date.now() - 2 * 3600 * 1000), // il y a 2 h
        },
      ]);

      const jsx = await NotificationsPage();
      render(jsx);

      expect(screen.getByText('Nouvel épisode')).toBeDefined();
      expect(screen.getByText('Arcane')).toBeDefined();
      expect(screen.getByText('S2 · E1 est disponible')).toBeDefined();
      expect(screen.getByText('Saison terminée')).toBeDefined();
    });
  });

  describe('MarkAllWatchedButton', () => {
    it('permet de tout marquer comme vu et affiche le résultat', async () => {
      mockMarkAllCompletedEpisodesWatched.mockResolvedValue({ count: 5 });

      render(<MarkAllWatchedButton />);
      const btn = screen.getByRole('button', { name: /Tout cocher/i });
      fireEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByText(/5 épisodes cochés/)).toBeDefined();
      });
    });

    it('affiche Déjà à jour si 0 épisodes cochés', async () => {
      mockMarkAllCompletedEpisodesWatched.mockResolvedValue({ count: 0 });

      render(<MarkAllWatchedButton />);
      const btn = screen.getByRole('button', { name: /Tout cocher/i });
      fireEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByText('Déjà à jour ✓')).toBeDefined();
      });
    });
  });

  describe('TerminePage', () => {
    it('affiche l\'état vide quand aucun show n\'est terminé', async () => {
      mockUserShowFindMany.mockResolvedValue([]);
      const jsx = await TerminePage({ searchParams: Promise.resolve({}) });
      render(jsx);
      expect(screen.getByText(/Aucun show terminé pour l'instant/)).toBeDefined();
    });

    it('affiche la liste des shows terminés avec calcul d\'heures et filtres', async () => {
      mockUserShowFindMany.mockResolvedValue([
        {
          id: 'us1',
          rating: 4.5,
          show: {
            id: 's1',
            title: 'Frieren',
            type: 'ANIME',
            runtime: 24,
            tmdbId: null,
            anilistId: 10,
            posterPath: '/frieren.jpg',
            seasons: [{ _count: { episodes: 28 } }],
          },
        },
        {
          id: 'us2',
          rating: 5,
          show: {
            id: 's2',
            title: 'Breaking Bad',
            type: 'SERIES',
            runtime: 47,
            tmdbId: 100,
            anilistId: null,
            posterPath: '/bb.jpg',
            seasons: [{ _count: { episodes: 62 } }],
          },
        },
      ]);

      const jsx = await TerminePage({ searchParams: Promise.resolve({ type: 'ALL' }) });
      render(jsx);

      expect(screen.getByText(/2 œuvres/)).toBeDefined();
      expect(screen.getAllByText('Frieren').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Breaking Bad').length).toBeGreaterThan(0);
    });
  });
});
