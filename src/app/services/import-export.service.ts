import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { StorageData } from '../models/storage.model';

@Injectable({
  providedIn: 'root'
})
export class ImportExportService {
  private storageService = inject(StorageService);


  exportData(): void {
    const data = this.storageService.getData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `watch-list-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async importData(file: File): Promise<void> {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      
      if (!this.validateStorageDataStructure(parsed)) {
        throw new Error('Invalid data format');
      }

      const migrated = this.storageService.migrateDataOnly(parsed as StorageData);
      this.storageService.ensureDefaults(migrated);
      
      if (!this.validateMigratedData(migrated)) {
        throw new Error('Invalid migrated data');
      }

      this.storageService.saveData(migrated);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON file', { cause: error });
      }
      throw error;
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
      !d['groups'] ||
      !d['items']
    ) {
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

    if (d['deletedItems']) {
      if (typeof d['deletedItems'] !== 'object' || Array.isArray(d['deletedItems'])) {
        return false;
      }
      const deletedItems = d['deletedItems'] as Record<string, unknown>;
      for (const entry of Object.values(deletedItems)) {
        if (!this.validateDeletedItem(entry)) {
          return false;
        }
      }
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

    const deletedItems = data.deletedItems;
    if (deletedItems) {
      for (const entry of Object.values(deletedItems)) {
        if (!this.validateDeletedItem(entry)) {
          return false;
        }
      }
    }

    return true;
  }

  private validateDeletedItem(entry: unknown): boolean {
    if (!entry || typeof entry !== 'object') {
      return false;
    }
    const e = entry as Record<string, unknown>;
    if (
      typeof e['itemId'] !== 'string' ||
      typeof e['itemTitle'] !== 'string' ||
      (e['itemType'] !== 'series' && e['itemType'] !== 'movie') ||
      typeof e['deletedAt'] !== 'string'
    ) {
      return false;
    }

    if (!Array.isArray(e['watchHistory'])) {
      return false;
    }
    for (const histEntry of e['watchHistory']) {
      if (!this.validateWatchHistoryEntry(histEntry)) {
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

