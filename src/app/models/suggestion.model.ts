import { ItemType, SeasonInfo } from './item.model';

export type SuggestionSource = 'tmdb' | 'mal';

export interface Suggestion {
  id: number;
  source: SuggestionSource;
  title: string;
  type: ItemType;
  year?: string;
  overview?: string;
  posterUrl?: string;
}

export interface SeriesDetails {
  seasons: SeasonInfo[];
}
