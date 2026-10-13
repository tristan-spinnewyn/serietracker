// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Icon } from '@/components/ui/icon';
import { JustWatchCredit } from '@/components/ui/justwatch-credit';
import { Poster, MiniPoster } from '@/components/ui/poster';
import { ProviderLogo, ProviderRow } from '@/components/ui/provider-logo';

describe('UI Components', () => {
  describe('Icon', () => {
    it('rend les différents SVG valides avec la taille passée', () => {
      const { container } = render(<Icon name="search" size={24} className="my-icon" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeDefined();
      expect(svg?.getAttribute('width')).toBe('24');
      expect(svg?.getAttribute('height')).toBe('24');
      expect(svg?.getAttribute('class')).toContain('my-icon');
    });

    it('rend des icônes spécifiques comme play, check, star, menu', () => {
      const names = ['play', 'check', 'star', 'menu', 'calendar', 'home', 'settings', 'bell'] as const;
      for (const name of names) {
        const { container } = render(<Icon name={name} />);
        expect(container.querySelector('svg')).toBeDefined();
      }
    });
  });

  describe('JustWatchCredit', () => {
    it('affiche le texte JustWatch', () => {
      render(<JustWatchCredit />);
      expect(screen.getByText('JustWatch')).toBeDefined();
    });
  });

  describe('Poster & MiniPoster', () => {
    it('Poster affiche le titre, le badge Anime/Série et l\'image si présente', () => {
      render(<Poster title="Frieren" type="ANIME" imageUrl="https://img/frieren.jpg" />);
      expect(screen.getByText('Frieren')).toBeDefined();
      expect(screen.getByText('Anime')).toBeDefined();
      const img = screen.getByAltText('Frieren') as HTMLImageElement;
      expect(img.src).toBe('https://img/frieren.jpg');
    });

    it('Poster génère un fallback de gradient sans image', () => {
      const { container } = render(<Poster title="Breaking Bad" type="SERIES" />);
      expect(screen.getByText('Breaking Bad')).toBeDefined();
      expect(screen.getByText('Série')).toBeDefined();
      expect(container.querySelector('.bg')).toBeDefined();
    });

    it('MiniPoster affiche l\'image ou le fallback', () => {
      const { rerender } = render(<MiniPoster title="Dune" imageUrl="https://img/dune.jpg" size={50} />);
      const img = screen.getByAltText('Dune') as HTMLImageElement;
      expect(img.src).toBe('https://img/dune.jpg');

      rerender(<MiniPoster title="Dune" size={50} />);
      expect(screen.queryByAltText('Dune')).toBeNull();
    });
  });

  describe('ProviderLogo & ProviderRow', () => {
    it('renvoie null si provider inconnu', () => {
      const { container } = render(<ProviderLogo id="unknown" />);
      expect(container.firstChild).toBeNull();
    });

    it('rend le logo pour Netflix avec mono N', () => {
      render(<ProviderLogo id="netflix" />);
      expect(screen.getByTitle('Netflix')).toBeDefined();
      expect(screen.getByText('N')).toBeDefined();
    });

    it('rend le SVG pour Apple TV+', () => {
      const { container } = render(<ProviderLogo id="appletv" />);
      expect(screen.getByTitle('Apple TV+')).toBeDefined();
      expect(container.querySelector('svg')).toBeDefined();
    });

    it('rend un lien externe quand href est fourni', () => {
      render(<ProviderLogo id="crunchyroll" href="https://crunchyroll.com" />);
      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('https://crunchyroll.com');
      expect(link.getAttribute('target')).toBe('_blank');
    });

    it('ProviderRow affiche les providers visibles et l\'indicateur +extra', () => {
      render(
        <ProviderRow
          ids={['netflix', 'prime', 'disney', 'canal', 'crunchyroll']}
          max={3}
          label="DISPO"
        />
      );
      expect(screen.getByText('DISPO')).toBeDefined();
      expect(screen.getByTitle('Netflix')).toBeDefined();
      expect(screen.getByTitle('Prime Video')).toBeDefined();
      expect(screen.getByTitle('Disney+')).toBeDefined();
      expect(screen.getByText('+2')).toBeDefined();
    });

    it('ProviderRow renvoie null si ids est vide', () => {
      const { container } = render(<ProviderRow ids={[]} />);
      expect(container.firstChild).toBeNull();
    });
  });
});
