// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { ActivityRow } from '@/components/shows/activity-row';
import { NowCard } from '@/components/shows/now-card';
import { UpcomingRow } from '@/components/shows/upcoming-row';

describe('Shows components', () => {
  describe('ActivityRow', () => {
    it('rend une entrée d\'activité système', () => {
      render(
        <ActivityRow
          entry={{
            id: '1',
            userName: 'System',
            userColor: '#ffffff',
            userInitials: 'SY',
            verb: 'Saison complète',
            showTitle: 'Severance',
            showType: 'SERIES',
            showPosterUrl: null,
            detail: '8 épisodes disponibles',
            when: 'hier',
            system: true,
          }}
        />
      );
      expect(screen.getByText('Saison complète')).toBeDefined();
      expect(screen.getByText('Severance')).toBeDefined();
      expect(screen.getByText('8 épisodes disponibles')).toBeDefined();
    });

    it('rend une entrée d\'activité utilisateur avec initiales et couleur', () => {
      render(
        <ActivityRow
          entry={{
            id: '2',
            userName: 'Thomas',
            userColor: '#ff0000',
            userInitials: 'TH',
            verb: 'a regardé',
            showTitle: 'Arcane',
            showType: 'SERIES',
            showPosterUrl: 'https://img/arcane.jpg',
            detail: 'S1 · E1',
            when: 'il y a 2h',
          }}
        />
      );
      expect(screen.getByText('Thomas')).toBeDefined();
      expect(screen.getByText('a regardé')).toBeDefined();
      expect(screen.getByText('Arcane')).toBeDefined();
      expect(screen.getByText('TH')).toBeDefined();
    });
  });

  describe('NowCard', () => {
    it('rend le show, la progression et navigue au clic', () => {
      render(
        <NowCard
          show={{
            id: 'show-1',
            title: 'Frieren',
            type: 'ANIME',
            genre: 'Fantasy',
            posterUrl: null,
            watchedCount: 14,
            totalEps: 28,
            nextEp: { s: 1, e: 15, title: 'La fête', date: 'demain' },
          }}
        />
      );

      expect(screen.getAllByText('Frieren').length).toBeGreaterThan(0);
      expect(screen.getByText('Fantasy')).toBeDefined();
      expect(screen.getByText('14/28')).toBeDefined();
      expect(screen.getByText('S1 · E15 — La fête')).toBeDefined();

      const btn = screen.getByRole('button');
      fireEvent.click(btn);
      expect(mockPush).toHaveBeenCalledWith('/show/show-1');
    });

    it('affiche le message quand aucun épisode n\'est à venir', () => {
      render(
        <NowCard
          show={{
            id: 'show-2',
            title: 'Breaking Bad',
            type: 'SERIES',
            genre: null,
            posterUrl: null,
            watchedCount: 62,
            totalEps: 62,
            nextEp: null,
          }}
        />
      );
      expect(screen.getByText('Aucun épisode à venir')).toBeDefined();
    });
  });

  describe('UpcomingRow', () => {
    it('rend l\'épisode à venir et permet de basculer la cloche de notification', () => {
      const { container } = render(
        <UpcomingRow
          item={{
            showId: 's1',
            showTitle: 'Re:Zero',
            type: 'ANIME',
            day: 15,
            month: 'MAI',
            ep: 'S3 · E1',
            epTitle: 'Nouveau départ',
            notify: true,
          }}
        />
      );

      expect(screen.getByText('15')).toBeDefined();
      expect(screen.getByText('MAI')).toBeDefined();
      expect(screen.getByText('Re:Zero')).toBeDefined();
      expect(screen.getByText('Anime')).toBeDefined();

      const bell = container.querySelector('button.bell') as HTMLElement;
      expect(bell.className).toContain('on');
      fireEvent.click(bell);
      expect(bell.className).not.toContain('on');
    });
  });
});
