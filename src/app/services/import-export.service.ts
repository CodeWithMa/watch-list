import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { StorageData, CURRENT_SCHEMA_VERSION } from '../models/storage.model';
import { IMPORT_EXPORT_ADAPTER, IImportExportAdapter } from './import-export.adapter';
import { Item } from '../models/item.model';

@Injectable({
  providedIn: 'root'
})
export class ImportExportService {
  private readonly adapter = inject(IMPORT_EXPORT_ADAPTER);
  private readonly storageService = inject(StorageService);

  async exportData(): Promise<void> {
    const data = this.storageService.getData();
    await this.adapter.exportData(data);
  }

  async importData(): Promise<void> {
    const result = await this.adapter.importData();
    
    if (!result) {
      return;
    }

    const { data } = result;
    
    if (!this.validateStorageDataStructure(data)) {
      throw new Error('Invalid data format');
    }

    const migrated = this.migrateDataOnly(data);
    this.ensureUngroupedGroup(migrated);
    
    if (!this.validateMigratedData(migrated)) {
      throw new Error('Invalid migrated data');
    }

    await this.storageService.saveData(migrated);
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

  private ensureUngroupedGroup(data: StorageData): void {
    if (!data.groups['ungrouped']) {
      data.groups['ungrouped'] = {
        id: 'ungrouped',
        name: 'Ungrouped',
        order: 0
      };
    }
  }

  private validateStorageDataStructure(data: unknown): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const d = data as Record<string, unknown>;

    if (
      typeof d['schemaVersion'] !== 'number' ||
      typeof d['lastModifiedAt'] !== 'string' ||
      !d['settings'] ||
      !d['groups'] ||
      !d['items']
    ) {
      return false;
    }

    const settings = d['settings'] as Record<string, unknown>;
    if (typeof settings['showCompleted'] !== 'boolean') {
      return false;
    }

    if (typeof d['groups'] !== 'object' || Array.isArray(d['groups'])) {
      return false;
    }
    const groups = d['groups'] as Record<string, unknown>;
    for (const group of Object.values(groups)) {
      if (!this.validateGroup(group)) {
        return false;
      }
    }

    if (typeof d['items'] !== 'object' || Array.isArray(d['items'])) {
      return false;
    }

    return true;
  }

  private validateGroup(group: unknown): boolean {
    if (!group || typeof group !== 'object') {
      return false;
    }
    const g = group as Record<string, unknown>;
    return (
      typeof g['id'] === 'string' &&
      typeof g['name'] === 'string' &&
      typeof g['order'] === 'number'
    );
  }

  private validateMigratedData(data: StorageData): boolean {
    const items = data.items;
    for (const item of Object.values(items)) {
      if (!this.validateItem(item)) {
        return false;
      }
    }
    return true;
  }

  private validateItem(item: unknown): boolean {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const i = item as Record<string, unknown>;
    
    if (
      typeof i['id'] !== 'string' ||
      typeof i['title'] !== 'string' ||
      typeof i['groupId'] !== 'string' ||
      typeof i['status'] !== 'string' ||
      typeof i['createdAt'] !== 'string' ||
      (i['type'] !== 'series' && i['type'] !== 'movie')
    ) {
      return false;
    }

    if (!Array.isArray(i['watchHistory'])) {
      return false;
    }
    for (const entry of i['watchHistory']) {
      if (!this.validateWatchHistoryEntry(entry)) {
        return false;
      }
    }

    if (i['type'] === 'series' && i['progress']) {
      const progress = i['progress'] as Record<string, unknown>;
      if (
        typeof progress['season'] !== 'number' ||
        typeof progress['episode'] !== 'number' ||
        (progress['totalEpisodes'] !== undefined && typeof progress['totalEpisodes'] !== 'number')
      ) {
        return false;
      }
    }

    return true;
  }

  private validateWatchHistoryEntry(entry: unknown): boolean {
    if (!entry || typeof entry !== 'object') {
      return false;
    }
    const e = entry as Record<string, unknown>;
    return typeof e['date'] === 'string';
  }
}