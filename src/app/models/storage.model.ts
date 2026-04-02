import { Item } from './item.model';
import { Group } from './group.model';

export interface Settings {
  showCompleted: boolean;
}

export interface StorageData {
  schemaVersion: number;
  lastModifiedAt: string;
  settings: Settings;
  groups: Record<string, Group>;
  items: Record<string, Item>;
}

export const CURRENT_SCHEMA_VERSION = 2;

