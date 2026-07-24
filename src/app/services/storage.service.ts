import { Injectable, signal } from '@angular/core';
import { StorageData } from '../models/storage.model';
import { Item } from '../models/item.model';
import { Group } from '../models/group.model';
import { createDefaultStorageData, normalizeStorageData } from '../domain/storage-schema';

const STORAGE_KEY = 'watchListData';

@Injectable({
  providedIn: 'root',
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
        const normalized = normalizeStorageData(JSON.parse(stored));
        this.data.set(normalized);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      } catch (error) {
        console.error('Failed to parse stored data:', error);
        const defaultData = createDefaultStorageData();
        this.data.set(defaultData);
        return defaultData;
      }
    }

    const defaultData = createDefaultStorageData();
    this.saveData(defaultData);
    return defaultData;
  }

  importData(data: unknown): StorageData {
    const normalized = normalizeStorageData(data);
    this.saveData(normalized);
    return normalized;
  }

  saveData(data: StorageData): void {
    const updated: StorageData = {
      ...data,
      lastModifiedAt: new Date().toISOString(),
    };
    this.data.set(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  getData(): StorageData {
    return this.data()!;
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
}
