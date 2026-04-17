import { Injectable, signal } from '@angular/core';
import { StorageData, CURRENT_SCHEMA_VERSION, DeletedItemHistory } from '../models/storage.model';
import { Item } from '../models/item.model';
import { Group } from '../models/group.model';

const STORAGE_KEY = 'watchListData';
const DEFAULT_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly data = signal<StorageData | null>(null);

  constructor() {
    this.loadData();
  }

  loadData(): StorageData {
    const stored = localStorage.getItem(STORAGE_KEY);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StorageData;
        const migrated = this.migrateDataOnly(parsed);
        this.ensureUngroupedGroup(migrated);
        this.data.set(migrated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      } catch (error) {
        console.error('Failed to parse stored data:', error);
        return this.createDefaultData();
      }
    }
    
    const defaultData = this.createDefaultData();
    this.saveData(defaultData);
    return defaultData;
  }

  migrateDataOnly(data: StorageData): StorageData {
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
          
          // Adjust episode numbers from 0-based to 1-based for non-completed items
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

    if (migrated.schemaVersion < 3) {
      migrated.deletedItems = {};
      migrated.schemaVersion = 3;
    }

    return migrated;
  }

  saveData(data: StorageData): void {
    const updated: StorageData = {
      ...data,
      lastModifiedAt: new Date().toISOString()
    };
    this.ensureUngroupedGroup(updated);
    this.data.set(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  getData(): StorageData {
    const current = this.data();
    if (current) {
      return current;
    }
    return this.loadData();
  }

  getDataSignal() {
    return this.data.asReadonly();
  }

  getItems(): Item[] {
    const data = this.getData();
    return Object.values(data.items);
  }

  getGroups(): Group[] {
    const data = this.getData();
    return Object.values(data.groups).sort((a, b) => a.order - b.order);
  }

  private createDefaultData(): StorageData {
    const now = new Date().toISOString();
    return {
      schemaVersion: DEFAULT_SCHEMA_VERSION,
      lastModifiedAt: now,
      groups: {
        ungrouped: {
          id: 'ungrouped',
          name: 'Ungrouped',
          order: 0
        }
      },
      items: {},
      deletedItems: {}
    };
  }

  ensureUngroupedGroup(data: StorageData): void {
    if (!data.groups['ungrouped']) {
      data.groups['ungrouped'] = {
        id: 'ungrouped',
        name: 'Ungrouped',
        order: 0
      };
    }
    if (!data.deletedItems) {
      data.deletedItems = {};
    }
  }
}

