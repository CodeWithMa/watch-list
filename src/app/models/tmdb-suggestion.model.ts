import { ItemType } from './item.model';
import { SeasonInfo } from './item.model';

export interface TmdbSuggestion {
  tmdbId: number;
  title: string;
  type: ItemType;
  year?: string;
  overview?: string;
  posterPath?: string;
}

export interface TmdbSeriesDetails {
  seasons: SeasonInfo[];
}
