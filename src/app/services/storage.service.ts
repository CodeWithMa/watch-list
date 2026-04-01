import { Injectable, signal } from '@angular/core';
import { StorageData, Settings, CURRENT_SCHEMA_VERSION } from '../models/storage.model';
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
        const migrated = this.migrateData(parsed);
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

  private migrateData(data: StorageData): StorageData {
    if (data.schemaVersion >= CURRENT_SCHEMA_VERSION) {
      return data;
    }

    let migrated = { ...data };

    if (migrated.schemaVersion < 2) {
      migrated.items = Object.fromEntries(
        Object.entries(migrated.items).map(([id, item]) => {
          const legacyItem = item as Item & { lastWatchedAt?: string; watchHistory?: unknown[] };
          let watchHistory = legacyItem.watchHistory as any[] || [];
          if (watchHistory.length === 0 && 
              (legacyItem.status === 'in-progress' || legacyItem.lastWatchedAt !== legacyItem.createdAt)) {
            const entry: any = { date: legacyItem.lastWatchedAt };
            if (legacyItem.type === 'series' && legacyItem.progress) {
              entry.season = legacyItem.progress.season;
              entry.episode = legacyItem.progress.episode;
            }
            watchHistory = [entry];
          }
          return [id, { ...item, watchHistory }];
        })
      );
      migrated.schemaVersion = 2;
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

  importAndMigrateData(data: StorageData): StorageData {
    let migrated = this.migrateData(data);
    this.ensureUngroupedGroup(migrated);
    migrated.lastModifiedAt = new Date().toISOString();
    this.data.set(migrated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
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

  getSettings(): Settings {
    const data = this.getData();
    return data.settings;
  }

  updateSettings(settings: Partial<Settings>): void {
    const data = this.getData();
    this.saveData({
      ...data,
      settings: { ...data.settings, ...settings }
    });
  }

  private createDefaultData(): StorageData {
    const now = new Date().toISOString();
    return {
      schemaVersion: DEFAULT_SCHEMA_VERSION,
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

