import { Item, ItemStatus } from '../models/item.model';
import { getMostRecentWatchDate } from './progress.utils';

export type SortField = 'title' | 'createdAt' | 'lastWatched' | 'status';
export type SortDirection = 'asc' | 'desc';

export const SORT_FIELDS: readonly SortField[] = [
  'title',
  'createdAt',
  'lastWatched',
  'status',
] as const;
export const SORT_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'] as const;

export const SORT_FIELD_LABELS: Record<SortField, string> = {
  title: 'Title',
  createdAt: 'Added date',
  lastWatched: 'Last watched date',
  status: 'Status',
};

const STATUS_SORT_ORDER: Record<ItemStatus, number> = {
  'in-progress': 0,
  'not-started': 1,
  paused: 2,
  completed: 3,
  dropped: 4,
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

function toTimestamp(date: string): number {
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

export function compareItems(a: Item, b: Item, field: SortField, direction: SortDirection): number {
  if (field === 'status') {
    return compareByStatus(a, b, direction);
  }

  let result: number;

  if (field === 'title') {
    result = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  } else if (field === 'createdAt') {
    result = toTimestamp(a.createdAt) - toTimestamp(b.createdAt);
  } else {
    result = toTimestamp(getMostRecentWatchDate(a)) - toTimestamp(getMostRecentWatchDate(b));
  }

  if (result === 0 || Number.isNaN(result)) {
    return 0;
  }

  return direction === 'asc' ? result : -result;
}

function compareByStatus(a: Item, b: Item, direction: SortDirection): number {
  const rankA = STATUS_SORT_ORDER[a.status] ?? Number.MAX_SAFE_INTEGER;
  const rankB = STATUS_SORT_ORDER[b.status] ?? Number.MAX_SAFE_INTEGER;
  const primary = rankA - rankB;

  if (primary !== 0) {
    return direction === 'asc' ? primary : -primary;
  }

  // Tie-breaker: most recently watched first, regardless of direction.
  const recent = toTimestamp(getMostRecentWatchDate(b)) - toTimestamp(getMostRecentWatchDate(a));
  if (recent !== 0 && !Number.isNaN(recent)) {
    return recent;
  }

  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

export function sortItems(items: Item[], field: SortField, direction: SortDirection): Item[] {
  return [...items].sort((a, b) => compareItems(a, b, field, direction));
}
