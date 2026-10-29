// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

const { mockPush, mockPathname, mockSignOut } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockPathname: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname(),
}));

vi.mock('next-auth/react', () => ({
  signOut: mockSignOut,
}));

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

describe('Layout components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/dashboard');
  });

  describe('Sidebar', () => {
    const defaultUser = {
      name: 'Léa',
      color: '#A855F7',
      initials: 'L',
      watchingCount: 4,
    };
    const defaultLists = [
      { id: 'l1', name: 'Mes animes', emoji: '🌸', color: '#ff0000', itemCount: 3, mine: true },
      { id: 'l2', name: 'Partagée', emoji: '🛋️', color: '#00ff00', itemCount: 2, mine: false },
    ];

    it('affiche la navigation, les listes personnelles et partagées', () => {
      const { container } = render(<Sidebar lists={defaultLists} user={defaultUser} unreadCount={3} />);

      expect(screen.getByText('Accueil')).toBeDefined();
      expect(screen.getByText('Bibliothèque')).toBeDefined();
      expect(screen.getByText('🌸 Mes animes')).toBeDefined();
      expect(screen.getByText('🛋️ Partagée')).toBeDefined();
      expect(container.querySelector('.nav-badge')?.textContent).toBe('3');
      expect(screen.getByText('Léa')).toBeDefined();
      expect(screen.getByText('4 shows en cours')).toBeDefined();
    });

    it('ouvre et ferme le menu mobile lors de l\'événement toggle-mobile-nav', () => {
      const { container } = render(<Sidebar lists={defaultLists} user={defaultUser} unreadCount={0} />);
      const aside = container.querySelector('aside');
      expect(aside?.className).not.toContain('open');

      act(() => {
        window.dispatchEvent(new Event('toggle-mobile-nav'));
      });
      expect(aside?.className).toContain('open');

      act(() => {
        window.dispatchEvent(new Event('toggle-mobile-nav'));
      });
      expect(aside?.className).not.toContain('open');
    });

    it('closes the mobile menu after navigating to another page', () => {
      const { container, rerender } = render(<Sidebar lists={defaultLists} user={defaultUser} unreadCount={0} />);
      act(() => {
        window.dispatchEvent(new Event('toggle-mobile-nav'));
      });
      expect(container.querySelector('aside')?.className).toContain('open');

      mockPathname.mockReturnValue('/library');
      rerender(<Sidebar lists={defaultLists} user={defaultUser} unreadCount={0} />);
      expect(container.querySelector('aside')?.className).not.toContain('open');
    });

    it('déclenche signOut lors du clic sur le bouton de déconnexion', () => {
      render(<Sidebar lists={defaultLists} user={defaultUser} unreadCount={0} />);
      const logoutBtn = screen.getByTitle('Se déconnecter');
      fireEvent.click(logoutBtn);
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/login' });
    });
  });

  describe('Topbar', () => {
    it('affiche le titre de la route actuelle', () => {
      mockPathname.mockReturnValue('/calendar');
      render(<Topbar />);
      expect(screen.getByText('Calendrier')).toBeDefined();
    });

    it('affiche le fil d\'Ariane Accueil / Fiche détaillée sur les pages /show/[id]', () => {
      mockPathname.mockReturnValue('/show/123');
      render(<Topbar />);
      expect(screen.getByText('Accueil')).toBeDefined();
      expect(screen.getByText('Fiche détaillée')).toBeDefined();

      fireEvent.click(screen.getByText('Accueil'));
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('navigue vers /search au clic sur le bouton recherche rapide', () => {
      mockPathname.mockReturnValue('/dashboard');
      render(<Topbar />);
      fireEvent.click(screen.getByText('Rechercher un show…'));
      expect(mockPush).toHaveBeenCalledWith('/search');
    });

    it('émet l\'événement toggle-mobile-nav au clic sur le bouton burger', () => {
      mockPathname.mockReturnValue('/dashboard');
      render(<Topbar />);
      const spy = vi.fn();
      window.addEventListener('toggle-mobile-nav', spy);

      const burger = screen.getByLabelText('Ouvrir la navigation');
      fireEvent.click(burger);
      expect(spy).toHaveBeenCalled();
    });
  });
});
