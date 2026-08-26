import { ItemStatus, ItemType } from '../models/item.model';

export const ITEM_TYPES: ItemType[] = ['series', 'movie', 'ova', 'ona'];
export const ITEM_STATUSES: ItemStatus[] = [
  'not-started',
  'in-progress',
  'paused',
  'completed',
  'dropped',
];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  series: 'Series',
  movie: 'Movie',
  ova: 'OVA',
  ona: 'ONA',
};

export function isEpisodicType(type: ItemType): boolean {
  return type !== 'movie';
}

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  paused: 'Paused',
  completed: 'Completed',
  dropped: 'Dropped',
};

export const DEFAULT_GROUP_ID = 'ungrouped';
