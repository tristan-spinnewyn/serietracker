import { describe, it, expect } from 'vitest';
import { parseAnilistProviders, parseAnilistProviderLinks } from '@/lib/anilist/client';

const link = (site: string, type = 'STREAMING', url = `https://${site.toLowerCase()}.com/anime/123`) =>
  ({ site, type, url });

describe('parseAnilistProviders', () => {
  it('mappe Crunchyroll vers crunchyroll', () => {
    expect(parseAnilistProviders([link('Crunchyroll')])).toEqual(['crunchyroll']);
  });

  it('mappe ADN vers adn', () => {
    expect(parseAnilistProviders([link('ADN')])).toEqual(['adn']);
    expect(parseAnilistProviders([link('Animation Digital Network')])).toEqual(['adn']);
  });

  it('mappe Netflix, Disney Plus, Amazon Prime Video', () => {
    const result = parseAnilistProviders([
      link('Netflix'),
      link('Disney Plus'),
      link('Amazon Prime Video'),
    ]);
    expect(result).toContain('netflix');
    expect(result).toContain('disney');
    expect(result).toContain('prime');
  });

  it('ignore les liens non-STREAMING', () => {
    expect(parseAnilistProviders([link('Crunchyroll', 'INFO')])).toEqual([]);
    expect(parseAnilistProviders([link('Netflix', 'SOCIAL')])).toEqual([]);
  });

  it('ignore les sites inconnus', () => {
    expect(parseAnilistProviders([link('UnknownSite')])).toEqual([]);
  });

  it('déduplique les providers', () => {
    const result = parseAnilistProviders([link('Crunchyroll'), link('Crunchyroll')]);
    expect(result).toEqual(['crunchyroll']);
  });

  it('retourne [] pour un tableau vide', () => {
    expect(parseAnilistProviders([])).toEqual([]);
  });
});

describe('parseAnilistProviderLinks', () => {
  it('extrait l\'URL pour un lien STREAMING connu', () => {
    const url = 'https://www.crunchyroll.com/re-zero';
    const result = parseAnilistProviderLinks([{ site: 'Crunchyroll', type: 'STREAMING', url }]);
    expect(result).toEqual({ crunchyroll: url });
  });

  it('ignore les liens sans URL', () => {
    const result = parseAnilistProviderLinks([{ site: 'Crunchyroll', type: 'STREAMING', url: undefined }]);
    expect(result).toEqual({});
  });

  it('ignore les liens non-STREAMING', () => {
    const result = parseAnilistProviderLinks([{ site: 'Crunchyroll', type: 'INFO', url: 'https://cr.com' }]);
    expect(result).toEqual({});
  });

  it('ignore les sites inconnus', () => {
    const result = parseAnilistProviderLinks([{ site: 'Inconnu', type: 'STREAMING', url: 'https://x.com' }]);
    expect(result).toEqual({});
  });

  it('fusionne plusieurs providers', () => {
    const result = parseAnilistProviderLinks([
      { site: 'Crunchyroll', type: 'STREAMING', url: 'https://cr.com/anime' },
      { site: 'ADN', type: 'STREAMING', url: 'https://adn.com/anime' },
    ]);
    expect(result).toEqual({
      crunchyroll: 'https://cr.com/anime',
      adn: 'https://adn.com/anime',
    });
  });

  it('retourne {} pour un tableau vide', () => {
    expect(parseAnilistProviderLinks([])).toEqual({});
  });
});
