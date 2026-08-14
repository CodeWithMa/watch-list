export type ItemType = 'series' | 'movie';
export type ItemStatus = 'not-started' | 'in-progress' | 'completed' | 'dropped';

export interface SeasonInfo {
  seasonNumber: number;
  totalEpisodes?: number;
  firstEpisodeAirDate?: string;
}

export interface SeriesProgress {
  season: number;
  episode: number;
  seasons: SeasonInfo[];
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
  posterId?: string;
}
