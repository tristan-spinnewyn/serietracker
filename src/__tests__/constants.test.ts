import { describe, it, expect } from 'vitest';
import { paletteFor, posterUrl, backdropUrl, PALETTES, TMDB_IMG_W500, TMDB_IMG_W1280 } from '@/lib/constants';

describe('paletteFor', () => {
  it('retourne un tableau de 3 strings', () => {
    const p = paletteFor('test');
    expect(p).toHaveLength(3);
    p.forEach(c => expect(c).toMatch(/^#[0-9a-fA-F]{6}$/));
  });

  it('retourne toujours la même palette pour le même seed', () => {
    expect(paletteFor('Re:Zero')).toEqual(paletteFor('Re:Zero'));
    expect(paletteFor('Breaking Bad')).toEqual(paletteFor('Breaking Bad'));
  });

  it('retourne des palettes différentes pour des seeds différents', () => {
    const results = new Set(PALETTES.map((_, i) => JSON.stringify(paletteFor(String(i)))));
    expect(results.size).toBeGreaterThan(1);
  });

  it('reste dans les limites du tableau PALETTES', () => {
    for (let i = 0; i < 50; i++) {
      const p = paletteFor(`show-${i}`);
      expect(PALETTES).toContainEqual(p);
    }
  });

  it('gère une chaîne vide sans crash', () => {
    expect(() => paletteFor('')).not.toThrow();
  });
});

describe('posterUrl', () => {
  it('retourne null si posterPath est null', () => {
    expect(posterUrl({ tmdbId: 1, anilistId: null, posterPath: null })).toBeNull();
  });

  it('préfixe avec TMDB pour les shows TMDB', () => {
    const url = posterUrl({ tmdbId: 1234, anilistId: null, posterPath: '/abc.jpg' });
    expect(url).toBe(`${TMDB_IMG_W500}/abc.jpg`);
  });

  it('retourne le chemin brut pour les animes AniList', () => {
    const raw = 'https://s4.anilist.co/file/abc.jpg';
    const url = posterUrl({ tmdbId: null, anilistId: 42, posterPath: raw });
    expect(url).toBe(raw);
  });

  it('utilise TMDB si tmdbId est présent même avec anilistId', () => {
    const url = posterUrl({ tmdbId: 5, anilistId: 10, posterPath: '/img.jpg' });
    expect(url).toContain('tmdb.org');
  });
});

describe('backdropUrl', () => {
  it('retourne null si backdropPath est null', () => {
    expect(backdropUrl({ tmdbId: 1, backdropPath: null })).toBeNull();
  });

  it('préfixe avec TMDB W1280 pour les shows TMDB', () => {
    const url = backdropUrl({ tmdbId: 1234, backdropPath: '/back.jpg' });
    expect(url).toBe(`${TMDB_IMG_W1280}/back.jpg`);
  });

  it('retourne le chemin brut pour AniList', () => {
    const raw = 'https://s4.anilist.co/banner/189046.jpg';
    const url = backdropUrl({ tmdbId: null, backdropPath: raw });
    expect(url).toBe(raw);
  });
});
