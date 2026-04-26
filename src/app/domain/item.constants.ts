import { ItemStatus, ItemType } from '../models/item.model';

export const ITEM_TYPES: ItemType[] = ['series', 'movie'];
export const ITEM_STATUSES: ItemStatus[] = ['not-started', 'in-progress', 'completed', 'dropped'];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  series: 'Series',
  movie: 'Movie'
};

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  completed: 'Completed',
  dropped: 'Dropped'
};

export const DEFAULT_GROUP_ID = 'ungrouped';

export function isItemType(value: unknown): value is ItemType {
  return typeof value === 'string' && ITEM_TYPES.includes(value as ItemType);
}

export function isItemStatus(value: unknown): value is ItemStatus {
  return typeof value === 'string' && ITEM_STATUSES.includes(value as ItemStatus);
}
