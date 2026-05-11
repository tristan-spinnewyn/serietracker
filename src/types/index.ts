export type MediaType = 'series' | 'anime';

export type ShowStatus =
  | 'RETURNING'
  | 'ENDED'
  | 'CANCELED'
  | 'UPCOMING'
  | 'IN_PRODUCTION';

export type WatchStatus =
  | 'WATCHING'
  | 'COMPLETED'
  | 'PLAN_TO_WATCH'
  | 'DROPPED'
  | 'PAUSED';

export interface User {
  id: string;
  name: string;
  color: string;
  initials: string;
}

export interface Provider {
  id: string;
  name: string;
  mono: string;
  bg: string;
}

export interface NextEp {
  s: number;
  e: number;
  title: string;
  date: string;
}

export interface SeasonComplete {
  s: number;
  when: string;
  runtime: string;
}

export interface Show {
  id: string;
  title: string;
  type: MediaType;
  palette: number;
  year: number;
  status: ShowStatus;
  genre: string;
  network: string;
  seasons: number;
  episodes: number;
  runtime: number;
  watched: number;
  total: number;
  providers: string[];
  nextEp?: NextEp;
  seasonComplete?: SeasonComplete;
}

export interface ActivityEntry {
  who: string;
  verb: string;
  target: string;
  detail: string;
  when: string;
  system?: boolean;
  list?: boolean;
}

export interface UpcomingEpisode {
  showId: string;
  day: number;
  month: string;
  ep: string;
  title: string;
  type: MediaType;
  notify: boolean;
}

export interface CalEpisode {
  showId: string;
  ep: string;
}

export interface SharedList {
  id: string;
  name: string;
  emoji: string;
  color: string;
  items: string[];
  members: string[];
}

export interface EpisodeDetail {
  n: number;
  title: string;
  runtime: string;
  date: string;
  done: boolean;
  next?: boolean;
}

export interface SeasonDetail {
  n: number;
  title: string;
  episodes: number;
  watched: number;
  year: number;
  expanded?: boolean;
  eps: EpisodeDetail[] | null;
}

export interface CastMember {
  name: string;
  role: string;
  initials: string;
}

export interface ShowFollower {
  uid: string;
  pos: string;
}

export interface ShowDetail {
  show: Show;
  synopsis: string;
  cast: CastMember[];
  followers: ShowFollower[];
  seasons: SeasonDetail[];
}
