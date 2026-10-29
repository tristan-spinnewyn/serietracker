'use client';

import {
  ANIME_GENRES, ANIME_SEASONS, currentAnimeSeason, type AnimeSearchFilters, type AnimeSeason,
} from '@/lib/anilist/search-filters';

const SEASON_LABELS: Record<AnimeSeason, string> = {
  WINTER: 'Hiver',
  SPRING: 'Printemps',
  SUMMER: 'Été',
  FALL: 'Automne',
};

const FIRST_YEAR = 1970;
// Newest first, including next year's announced seasons
const YEARS = Array.from({ length: new Date().getFullYear() + 2 - FIRST_YEAR }, (_, i) => new Date().getFullYear() + 1 - i);

/** Genre / season / year pickers for browsing AniList from the search page. */
export function AnimeFilters({ value, onChange }: { value: AnimeSearchFilters; onChange: (f: AnimeSearchFilters) => void }) {
  const genre = value.genres?.[0] ?? '';
  const current = currentAnimeSeason();
  const onCurrentSeason = value.season === current.season && value.seasonYear === current.seasonYear;

  return (
    <div className="filter-chips">
      <button
        className={`chip ${onCurrentSeason ? 'on' : ''}`}
        onClick={() => onChange(onCurrentSeason
          ? { ...value, season: undefined, seasonYear: undefined }
          : { ...value, ...current })}
      >
        Saison en cours
      </button>
      <button
        className={`chip ${value.finishedOnly ? 'on' : ''}`}
        onClick={() => onChange({ ...value, finishedOnly: value.finishedOnly ? undefined : true })}
      >
        Terminés
      </button>
      <select
        aria-label="Genre"
        className={`chip ${genre ? 'on' : ''}`}
        value={genre}
        onChange={e => onChange({ ...value, genres: e.target.value ? [e.target.value] : undefined })}
      >
        <option value="">Tous les genres</option>
        {ANIME_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <select
        aria-label="Saison"
        className={`chip ${value.season ? 'on' : ''}`}
        value={value.season ?? ''}
        onChange={e => onChange({ ...value, season: (e.target.value || undefined) as AnimeSeason | undefined })}
      >
        <option value="">Toutes les saisons</option>
        {ANIME_SEASONS.map(s => <option key={s} value={s}>{SEASON_LABELS[s]}</option>)}
      </select>
      <select
        aria-label="Année"
        className={`chip ${value.seasonYear ? 'on' : ''}`}
        value={value.seasonYear ?? ''}
        onChange={e => onChange({ ...value, seasonYear: e.target.value ? Number(e.target.value) : undefined })}
      >
        <option value="">Toutes les années</option>
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
