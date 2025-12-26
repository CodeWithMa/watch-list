import { Item } from './item.model';
import { Group } from './group.model';

export interface Settings {
  showCompleted: boolean;
}

export interface StorageData {
  schemaVersion: number;
  lastModifiedAt: string; // ISO 8601 date string
  settings: Settings;
  groups: Record<string, Group>;
  items: Record<string, Item>;
}

