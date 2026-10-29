export interface ShowRef { id: string; title: string; type: 'SERIES' | 'ANIME'; year: number | null; network: string | null; tmdbId: number | null; anilistId: number | null; posterPath: string | null; }
export interface ListItem { id: string; show: ShowRef; addedBy: { name: string; color: string; initials: string }; }
export interface ListMember { user: { id: string; name: string; color: string; initials: string }; }
export interface ListData { id: string; name: string; emoji: string; color: string; members: ListMember[]; items: ListItem[]; }
