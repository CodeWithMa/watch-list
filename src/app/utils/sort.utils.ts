import { Item } from '../models/item.model';
import { getMostRecentWatchDate } from './progress.utils';

export type SortField = 'title' | 'createdAt' | 'lastWatched';
export type SortDirection = 'asc' | 'desc';

export const SORT_FIELDS: readonly SortField[] = ['title', 'createdAt', 'lastWatched'] as const;
export const SORT_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'] as const;

export const SORT_FIELD_LABELS: Record<SortField, string> = {
  title: 'Title',
  createdAt: 'Added date',
  lastWatched: 'Last watched date',
};

export const SORT_DIRECTION_LABELS: Record<SortDirection, string> = {
  asc: 'Ascending',
  desc: 'Descending',
};

export function isSortField(value: unknown): value is SortField {
  return typeof value === 'string' && (SORT_FIELDS as readonly string[]).includes(value);
}

export function isSortDirection(value: unknown): value is SortDirection {
  return typeof value === 'string' && (SORT_DIRECTIONS as readonly string[]).includes(value);
}

export function compareItems(a: Item, b: Item, field: SortField, direction: SortDirection): number {
  let result: number;

  if (field === 'title') {
    result = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  } else if (field === 'createdAt') {
    result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  } else {
    result =
      new Date(getMostRecentWatchDate(a)).getTime() - new Date(getMostRecentWatchDate(b)).getTime();
  }

  if (result === 0) {
    return 0;
  }

  return direction === 'asc' ? result : -result;
}

export function sortItems(items: Item[], field: SortField, direction: SortDirection): Item[] {
  return [...items].sort((a, b) => compareItems(a, b, field, direction));
}
