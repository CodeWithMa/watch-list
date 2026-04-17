import { Item } from './item.model';
import { Group } from './group.model';
import { ItemType } from './item.model';

export interface DeletedItemHistory {
  itemId: string;
  itemTitle: string;
  itemType: ItemType;
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

