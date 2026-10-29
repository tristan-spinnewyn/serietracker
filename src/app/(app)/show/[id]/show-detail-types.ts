import type { RelationType } from '@prisma/client';

export interface ListOption { id: string; name: string; emoji: string; color: string; itemCount: number; hasShow: boolean; }

export const REL_LABEL: Record<string, string> = {
  SEQUEL:      'Suite',
  PREQUEL:     'Préquelle',
  SPINOFF:     'Spin-off',
  ALTERNATIVE: 'Version alternative',
  PARENT:      'Œuvre originale',
  RELATED:     'Lié',
};

export const STATUS_LABEL: Record<string, string> = {
  RETURNING: 'En cours', ENDED: 'Terminée', CANCELED: 'Annulée',
  UPCOMING: 'À venir', IN_PRODUCTION: 'En production',
};
export const WATCH_LABEL: Record<string, string> = {
  WATCHING: 'En cours', COMPLETED: 'Terminé', PLAN_TO_WATCH: 'À regarder',
  DROPPED: 'Abandonné', PAUSED: 'En pause',
};

export interface ShowProps {
  id: string; title: string; type: string; status: string;
  year: number | null; overview: string | null;
  posterUrl: string | null; backdropUrl: string | null;
  network: string | null; genre: string | null;
  runtime: number | null; totalSeasons: number; providers: string[]; providerLinks: Record<string, string>;
}
export interface EpisodeProps {
  id: string; number: number; title: string;
  runtime: string; airDate: string; watched: boolean; isNext: boolean; hasAired: boolean;
}
export interface SeasonProps {
  id: string; number: number; title: string; year: number | null;
  episodeCount: number; watchedCount: number; episodes: EpisodeProps[];
}
export interface NextEpProps {
  id: string; seasonNumber: number; episodeNumber: number; title: string; airDate: string | null;
}
export interface FollowerProps {
  user: { id: string; name: string; color: string; initials: string };
  status: string;
}

export interface RelationItem {
  id: string; title: string; type: string; year: number | null;
  status: string; posterUrl: string | null; relationType: RelationType;
}
