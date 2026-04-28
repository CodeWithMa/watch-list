export type ItemType = 'series' | 'movie';
export type ItemStatus = 'not-started' | 'in-progress' | 'completed' | 'dropped';

export interface SeriesProgress {
  season: number;
  episode: number;
  totalEpisodes?: number;
  totalSeasons?: number;
}

export interface WatchHistoryEntry {
  date: string;
  season?: number;
  episode?: number;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  groupId: string;
  status: ItemStatus;
  progress?: SeriesProgress;
  watchHistory: WatchHistoryEntry[];
  createdAt: string;
}

