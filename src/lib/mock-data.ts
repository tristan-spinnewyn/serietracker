import type {
  User, Provider, Show, ActivityEntry,
  UpcomingEpisode, CalEpisode, SharedList, ShowDetail,
} from '@/types';

export const PALETTES: [string, string, string][] = [
  ['#3B0764', '#A855F7', '#F0ABFC'],
  ['#0C4A6E', '#0EA5E9', '#7DD3FC'],
  ['#7C2D12', '#FB7185', '#FECDD3'],
  ['#064E3B', '#34D399', '#A7F3D0'],
  ['#422006', '#F59E0B', '#FCD34D'],
  ['#1E1B4B', '#6366F1', '#A5B4FC'],
  ['#4A044E', '#D946EF', '#F5D0FE'],
  ['#831843', '#EC4899', '#FBCFE8'],
  ['#1F2937', '#94A3B8', '#E2E8F0'],
  ['#022C22', '#10B981', '#6EE7B7'],
  ['#451A03', '#EA580C', '#FED7AA'],
  ['#312E81', '#818CF8', '#C7D2FE'],
];

export const USERS: User[] = [
  { id: 'u1', name: 'Léa',     color: '#A855F7', initials: 'L' },
  { id: 'u2', name: 'Thomas',  color: '#FB7185', initials: 'T' },
  { id: 'u3', name: 'Camille', color: '#34D399', initials: 'C' },
  { id: 'u4', name: 'Hugo',    color: '#FBBF24', initials: 'H' },
  { id: 'u5', name: 'Sofia',   color: '#60A5FA', initials: 'S' },
];

export const ME = USERS[0];

export const PROVIDERS: Record<string, Provider> = {
  netflix:     { id: 'netflix',     name: 'Netflix',     mono: 'N', bg: '#E50914' },
  prime:       { id: 'prime',       name: 'Prime Video', mono: 'P', bg: '#00A8E1' },
  disney:      { id: 'disney',      name: 'Disney+',     mono: 'D', bg: '#0D1F3C' },
  canal:       { id: 'canal',       name: 'Canal+',      mono: 'C', bg: '#000000' },
  crunchyroll: { id: 'crunchyroll', name: 'Crunchyroll', mono: 'C', bg: '#F47521' },
  adn:         { id: 'adn',         name: 'ADN',         mono: 'A', bg: '#1B1B1B' },
  max:         { id: 'max',         name: 'Max',         mono: 'M', bg: '#002BE7' },
  appletv:     { id: 'appletv',     name: 'Apple TV+',   mono: '', bg: '#000000' },
  arte:        { id: 'arte',        name: 'Arte',        mono: 'A', bg: '#1E1E1E' },
  francetv:    { id: 'francetv',    name: 'France.tv',   mono: 'F', bg: '#0F2A4A' },
  tf1:         { id: 'tf1',         name: 'TF1+',        mono: 'T', bg: '#0E2A6E' },
  hidive:      { id: 'hidive',      name: 'HIDIVE',      mono: 'H', bg: '#00C2C2' },
};

export const SHOWS: Show[] = [
  { id: 's1',  title: 'Le Dernier Train',            type: 'series', palette: 0,  year: 2024, status: 'RETURNING',     genre: 'Drame · Thriller',     network: 'Canal+',      seasons: 3, episodes: 28, runtime: 52, watched: 18, total: 28, providers: ['canal','prime'],            nextEp: { s: 3, e: 5, title: 'Sous la cendre',   date: "Aujourd'hui · 21:00" } },
  { id: 's2',  title: 'Marina Eclipse',               type: 'anime',  palette: 6,  year: 2025, status: 'RETURNING',     genre: 'Action · Surnaturel',  network: 'Crunchyroll', seasons: 2, episodes: 24, runtime: 24, watched: 11, total: 24, providers: ['crunchyroll','adn'],        nextEp: { s: 2, e: 4, title: 'La Nuit du Récif',  date: 'Demain · 18:30' } },
  { id: 's3',  title: 'Verre Brisé',                  type: 'series', palette: 8,  year: 2023, status: 'ENDED',         genre: 'Noir · Procédural',    network: 'Arte',        seasons: 4, episodes: 32, runtime: 48, watched: 32, total: 32, providers: ['arte','francetv'],          seasonComplete: { s: 4, when: 'il y a 2 j', runtime: '26h' } },
  { id: 's4',  title: "Sentinelles d'Apocrypha",      type: 'anime',  palette: 5,  year: 2024, status: 'IN_PRODUCTION', genre: 'Mecha · Aventure',     network: 'Netflix',     seasons: 1, episodes: 12, runtime: 24, watched: 12, total: 12, providers: ['netflix'] },
  { id: 's5',  title: 'La Vallée des Signes',         type: 'series', palette: 3,  year: 2026, status: 'UPCOMING',      genre: 'Science-Fiction',      network: 'AppleTV+',    seasons: 0, episodes: 0,  runtime: 55, watched: 0,  total: 8,  providers: ['appletv'],                  nextEp: { s: 1, e: 1, title: 'Pilote', date: '24 mai' } },
  { id: 's6',  title: 'Kintsugi',                     type: 'anime',  palette: 7,  year: 2025, status: 'RETURNING',     genre: 'Slice of life',        network: 'ADN',         seasons: 1, episodes: 6,  runtime: 24, watched: 3,  total: 12, providers: ['adn','crunchyroll'],        nextEp: { s: 1, e: 7, title: 'Or fendu', date: 'Vendredi · 17:00' } },
  { id: 's7',  title: "Bouclier d'Hier",              type: 'series', palette: 2,  year: 2024, status: 'RETURNING',     genre: 'Historique',           network: 'France.tv',   seasons: 2, episodes: 16, runtime: 50, watched: 9,  total: 16, providers: ['francetv','canal'] },
  { id: 's8',  title: 'Hyperion Drift',               type: 'anime',  palette: 1,  year: 2025, status: 'RETURNING',     genre: 'Cyberpunk',            network: 'HIDIVE',      seasons: 1, episodes: 10, runtime: 24, watched: 5,  total: 12, providers: ['hidive','crunchyroll'] },
  { id: 's9',  title: 'Sous les Tuiles',              type: 'series', palette: 4,  year: 2024, status: 'ENDED',         genre: 'Comédie',              network: 'Canal+',      seasons: 3, episodes: 30, runtime: 28, watched: 0,  total: 30, providers: ['canal','prime'],            seasonComplete: { s: 3, when: 'il y a 5 j', runtime: '14h' } },
  { id: 's10', title: 'Ozone',                        type: 'series', palette: 9,  year: 2026, status: 'UPCOMING',      genre: 'Eco-thriller',         network: 'Max',         seasons: 0, episodes: 0,  runtime: 50, watched: 0,  total: 8,  providers: ['max'] },
  { id: 's11', title: 'Nautilus Sept',                type: 'anime',  palette: 10, year: 2025, status: 'RETURNING',     genre: 'Aventure',             network: 'Crunchyroll', seasons: 1, episodes: 9,  runtime: 24, watched: 4,  total: 13, providers: ['crunchyroll'] },
  { id: 's12', title: 'Verdict',                      type: 'series', palette: 11, year: 2024, status: 'RETURNING',     genre: 'Procédural',           network: 'TF1+',        seasons: 5, episodes: 40, runtime: 46, watched: 22, total: 40, providers: ['tf1','francetv'] },
  { id: 's13', title: 'Marécage',                     type: 'series', palette: 9,  year: 2025, status: 'ENDED',         genre: 'Drame · Sud',          network: 'Max',         seasons: 1, episodes: 8,  runtime: 56, watched: 0,  total: 8,  providers: ['max'],                      seasonComplete: { s: 1, when: 'hier', runtime: '7h30' } },
  { id: 's14', title: 'Lune Pâle',                    type: 'anime',  palette: 11, year: 2025, status: 'ENDED',         genre: 'Romance · Surnaturel', network: 'ADN',         seasons: 1, episodes: 12, runtime: 24, watched: 0,  total: 12, providers: ['adn'],                      seasonComplete: { s: 1, when: 'il y a 3 j', runtime: '4h48' } },
];

export const NOW_WATCHING = ['s1','s2','s6','s8'].map(id => SHOWS.find(s => s.id === id)!);
export const PLAN_TO_WATCH = ['s5','s10','s9'].map(id => SHOWS.find(s => s.id === id)!);
export const RECENTLY_FINISHED = ['s3','s4'].map(id => SHOWS.find(s => s.id === id)!);
export const BINGE_CATCHUP  = ['s3','s9'].map(id => SHOWS.find(s => s.id === id)!);
export const BINGE_DISCOVER = ['s13','s14'].map(id => SHOWS.find(s => s.id === id)!);

export const USER_PROVIDERS = ['canal','crunchyroll','adn','netflix'];

export const ACTIVITY: ActivityEntry[] = [
  { who: 'u2', verb: 'a fini',     target: 's3',  detail: 'Saison 4 · binge en 2 jours',              when: 'il y a 14 min' },
  { who: '_sys', verb: 'Saison complète', target: 's13', detail: 'S1 · 8 épisodes · prête à enchaîner', when: 'hier · 21:00', system: true },
  { who: 'u3', verb: 'regarde',    target: 's2',  detail: 'S2 · E3',                                   when: 'il y a 38 min' },
  { who: 'u4', verb: 'a ajouté à', target: 's5',  detail: 'À voir cet été',                            when: 'il y a 2 h', list: true },
  { who: 'u2', verb: 'a noté',     target: 's1',  detail: '★ 4.5',                                     when: 'il y a 3 h' },
  { who: 'u5', verb: 'a commencé', target: 's11', detail: 'S1 · E1',                                   when: 'hier · 22:14' },
  { who: 'u3', verb: 'a ajouté',   target: 's7',  detail: 'à sa liste',                                when: 'hier · 18:02' },
];

export const UPCOMING: UpcomingEpisode[] = [
  { showId: 's1',  day: 10, month: 'MAI', ep: 'S3 · E5',  title: 'Sous la cendre',   type: 'series', notify: true },
  { showId: 's2',  day: 11, month: 'MAI', ep: 'S2 · E4',  title: 'La Nuit du Récif', type: 'anime',  notify: true },
  { showId: 's6',  day: 14, month: 'MAI', ep: 'S1 · E7',  title: 'Or fendu',         type: 'anime',  notify: false },
  { showId: 's8',  day: 14, month: 'MAI', ep: 'S1 · E6',  title: 'Strates de neon',  type: 'anime',  notify: true },
  { showId: 's12', day: 15, month: 'MAI', ep: 'S5 · E12', title: 'Conscience',       type: 'series', notify: true },
];

export const CAL_EPS: Record<number, CalEpisode[]> = {
  3:  [{ showId: 's12', ep: 'E10' }],
  5:  [{ showId: 's1',  ep: 'E4' }, { showId: 's11', ep: 'E4' }],
  7:  [{ showId: 's6',  ep: 'E6' }],
  10: [{ showId: 's1',  ep: 'E5' }],
  11: [{ showId: 's2',  ep: 'E4' }],
  14: [{ showId: 's6',  ep: 'E7' }, { showId: 's8',  ep: 'E6' }],
  15: [{ showId: 's12', ep: 'E12' }, { showId: 's11', ep: 'E5' }],
  17: [{ showId: 's1',  ep: 'E6' }],
  18: [{ showId: 's2',  ep: 'E5' }],
  21: [{ showId: 's6',  ep: 'E8' }, { showId: 's7',  ep: 'E10' }],
  22: [{ showId: 's12', ep: 'E13' }],
  24: [{ showId: 's5',  ep: 'E1' }, { showId: 's1', ep: 'E7' }],
  25: [{ showId: 's2',  ep: 'E6' }, { showId: 's8', ep: 'E7' }],
  28: [{ showId: 's6',  ep: 'E9' }],
  29: [{ showId: 's12', ep: 'E14' }],
};

export const LISTS: SharedList[] = [
  { id: 'l1', name: 'À regarder cet été',     emoji: '☀️', color: '#FBBF24', items: ['s5','s10','s9','s7'], members: ['u1','u2','u3','u4'] },
  { id: 'l2', name: 'Comédies du dimanche',   emoji: '🛋️', color: '#34D399', items: ['s9','s12'],           members: ['u1','u2'] },
  { id: 'l3', name: 'Animes cosy',            emoji: '🌸', color: '#FB7185', items: ['s6','s11'],           members: ['u1','u3','u5'] },
  { id: 'l4', name: 'Recommandations Thomas', emoji: '🎯', color: '#A855F7', items: ['s3','s4','s1'],       members: ['u1','u2'] },
];

export const DETAIL_S1: ShowDetail = {
  show: SHOWS[0],
  synopsis: "Sur une ligne ferroviaire qui dessert un littoral isolé, un contrôleur découvre qu'un même passager monte chaque soir au même quai — sans jamais redescendre. À mesure que l'enquête le pousse hors des rails, la frontière entre superstition locale et faits avérés s'érode.",
  cast: [
    { name: 'Aïcha Dembélé',  role: 'Inès Marchais',  initials: 'AD' },
    { name: 'Pierre Vasseur', role: 'Jean Coulanges', initials: 'PV' },
    { name: 'Margot Hérault', role: 'Dr. Saron',      initials: 'MH' },
    { name: 'Lucas Brienne',  role: 'Le passager',    initials: 'LB' },
  ],
  followers: [
    { uid: 'u1', pos: 'S3 · E4' },
    { uid: 'u2', pos: 'S3 · E2' },
    { uid: 'u3', pos: 'S2 · E8' },
  ],
  seasons: [
    { n: 1, title: 'Saison 1 · Ligne A',           episodes: 8,  watched: 8,  year: 2022, eps: null },
    { n: 2, title: 'Saison 2 · Hors-quai',         episodes: 10, watched: 10, year: 2023, eps: null },
    { n: 3, title: 'Saison 3 · Sous la cendre',    episodes: 10, watched: 4,  year: 2026, expanded: true, eps: [
      { n: 1, title: 'Le retour des marées',         runtime: '52 min', date: '12 avr.', done: true },
      { n: 2, title: 'Quai trois, vingt-deux heures',runtime: '54 min', date: '19 avr.', done: true },
      { n: 3, title: 'Carnets bleus',                runtime: '49 min', date: '26 avr.', done: true },
      { n: 4, title: 'Le passager du dimanche',      runtime: '51 min', date: '03 mai',  done: true },
      { n: 5, title: 'Sous la cendre',               runtime: '53 min', date: '10 mai',  done: false, next: true },
      { n: 6, title: "L'onde porteuse",              runtime: '—',      date: '17 mai',  done: false },
      { n: 7, title: 'Tout ce qui ne revient pas',   runtime: '—',      date: '24 mai',  done: false },
    ]},
  ],
};
