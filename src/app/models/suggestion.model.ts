import { ItemType, SeasonInfo } from './item.model';

export type SuggestionSource = 'tmdb' | 'jikan' | 'anilist';

export interface Suggestion {
  id: number;
  source: SuggestionSource;
  title: string;
  type: ItemType;
  year?: string;
  overview?: string;
  posterUrl?: string;
  isAdult: boolean;
}

export interface SeriesDetails {
  seasons: SeasonInfo[];
}
