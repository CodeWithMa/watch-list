import { IStorageAdapter } from './storage.adapter';
import { StorageData } from '../models/storage.model';
import { migrateDataOnly, ensureUngroupedGroup, createDefaultData } from '../shared/data-migration';

const STORAGE_KEY = 'watchListData';

export class LocalStorageAdapter implements IStorageAdapter {
  load(): StorageData {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StorageData;
        const migrated = migrateDataOnly(parsed);
        ensureUngroupedGroup(migrated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      } catch (error) {
        console.error('Failed to parse stored data:', error);
        return createDefaultData();
      }
    }

    const defaultData = createDefaultData();
    this.save(defaultData);
    return defaultData;
  }

  save(data: StorageData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}
