import { IStorageAdapter } from './storage.adapter';
import { StorageData, CURRENT_SCHEMA_VERSION } from '../models/storage.model';
import { Item } from '../models/item.model';
import { Group } from '../models/group.model';
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

const STORAGE_DIR = 'watch-list';
const STORAGE_FILE = 'data.json';

export class TauriFileStorageAdapter implements IStorageAdapter {
  private cache: StorageData | null = null;

  private async ensureDir(): Promise<void> {
    const dirExists = await exists(STORAGE_DIR, { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
      await mkdir(STORAGE_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
    }
  }

  async load(): Promise<StorageData> {
    try {
      await this.ensureDir();
      const path = `${STORAGE_DIR}/${STORAGE_FILE}`;
      const fileExists = await exists(path, { baseDir: BaseDirectory.AppData });
      
      if (!fileExists) {
        const defaultData = this.createDefaultData();
        await this.save(defaultData);
        return defaultData;
      }

      const content = await readTextFile(path, { baseDir: BaseDirectory.AppData });
      const parsed = JSON.parse(content) as StorageData;
      
      const migrated = this.migrateDataOnly(parsed);
      this.ensureUngroupedGroup(migrated);
      
      this.cache = migrated;
      await this.save(migrated);
      
      return migrated;
    } catch (error) {
      console.error('Failed to load file data:', error);
      return this.createDefaultData();
    }
  }

  async save(data: StorageData): Promise<void> {
    try {
      await this.ensureDir();
      
      const path = `${STORAGE_DIR}/${STORAGE_FILE}`;
      await writeTextFile(path, JSON.stringify(data, null, 2), { baseDir: BaseDirectory.AppData });
      
      this.cache = data;
    } catch (error) {
      console.error('Failed to save file data:', error);
      throw error;
    }
  }

  loadSync(): StorageData {
    if (this.cache) {
      return this.cache;
    }
    throw new Error('Data not loaded. Call load() first.');
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