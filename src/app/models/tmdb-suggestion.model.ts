import { ItemType } from './item.model';

export interface TmdbSuggestion {
  tmdbId: number;
  title: string;
  type: ItemType;
  year?: string;
  overview?: string;
  posterPath?: string;
}
