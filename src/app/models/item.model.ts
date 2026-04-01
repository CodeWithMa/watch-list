export type ItemType = 'series' | 'movie';
export type ItemStatus = 'not-started' | 'in-progress' | 'completed';

export interface SeriesProgress {
  season: number;
  episode: number;
  totalEpisodes?: number;
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
  lastWatchedAt: string;
  createdAt: string;
}

