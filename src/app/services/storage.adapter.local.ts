import { IStorageAdapter } from './storage.adapter';
import { StorageData, CURRENT_SCHEMA_VERSION } from '../models/storage.model';
import { Item } from '../models/item.model';
import { Group } from '../models/group.model';

const STORAGE_KEY = 'watchListData';

export class LocalStorageAdapter implements IStorageAdapter {
  load(): StorageData {
    const stored = localStorage.getItem(STORAGE_KEY);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StorageData;
        const migrated = this.migrateDataOnly(parsed);
        this.ensureUngroupedGroup(migrated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      } catch (error) {
        console.error('Failed to parse stored data:', error);
        return this.createDefaultData();
      }
    }
    
    const defaultData = this.createDefaultData();
    this.save(defaultData);
    return defaultData;
  }

  save(data: StorageData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  private migrateDataOnly(data: StorageData): StorageData {
    if (data.schemaVersion >= CURRENT_SCHEMA_VERSION) {
      return data;
    }

    let migrated = { ...data };

    if (migrated.schemaVersion < 2) {
      migrated.items = Object.fromEntries(
        Object.entries(migrated.items).map(([id, item]) => {
          const legacyItem = item as Item & { 
            lastWatchedAt?: string; 
            watchHistory?: unknown[];
            progress?: { season: number; episode: number; totalEpisodes?: number };
          };
          let watchHistory = legacyItem.watchHistory as any[] || [];
          
          let adjustedProgress = legacyItem.progress;
          if (adjustedProgress && legacyItem.status !== 'completed') {
            adjustedProgress = {
              ...adjustedProgress,
              episode: adjustedProgress.episode + 1
            };
          }
          
          if (watchHistory.length === 0 && 
              (legacyItem.status === 'in-progress' || legacyItem.lastWatchedAt !== legacyItem.createdAt)) {
            const entry: any = { date: legacyItem.lastWatchedAt };
            if (legacyItem.type === 'series' && legacyItem.progress) {
              entry.season = legacyItem.progress.season;
              entry.episode = legacyItem.progress.episode;
            }
            watchHistory = [entry];
          }
          
          const { lastWatchedAt, ...itemWithoutLastWatched } = legacyItem;
          return [id, { ...itemWithoutLastWatched, watchHistory, progress: adjustedProgress }];
        })
      );
      migrated.schemaVersion = 2;
    }

    return migrated;
  }

  private createDefaultData(): StorageData {
    const now = new Date().toISOString();
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      lastModifiedAt: now,
      settings: {
        showCompleted: false
      },
      groups: {
        ungrouped: {
          id: 'ungrouped',
          name: 'Ungrouped',
          order: 0
        }
      },
      items: {}
    };
  }

  private ensureUngroupedGroup(data: StorageData): void {
    if (!data.groups['ungrouped']) {
      data.groups['ungrouped'] = {
        id: 'ungrouped',
        name: 'Ungrouped',
        order: 0
      };
    }
  }
}