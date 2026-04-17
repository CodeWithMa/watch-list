import { Item, ItemType, WatchHistoryEntry } from './item.model';
import { Group } from './group.model';

export interface DeletedItemHistory {
  itemId: string;
  itemTitle: string;
  itemType: ItemType;
  watchHistory: WatchHistoryEntry[];
  deletedAt: string;
}

export interface StorageData {
  schemaVersion: number;
  lastModifiedAt: string;
  groups: Record<string, Group>;
  items: Record<string, Item>;
  deletedItems?: Record<string, DeletedItemHistory>;
}

export const CURRENT_SCHEMA_VERSION = 3;

