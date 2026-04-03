import { Injectable, signal, inject } from '@angular/core';
import { StorageData, Settings } from '../models/storage.model';
import { Item } from '../models/item.model';
import { Group } from '../models/group.model';
import { STORAGE_ADAPTER, IStorageAdapter } from './storage.adapter';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly adapter = inject(STORAGE_ADAPTER);
  private readonly data = signal<StorageData | null>(null);

  async loadData(): Promise<StorageData> {
    const loaded = await this.adapter.load();
    this.data.set(loaded);
    return loaded;
  }

  async saveData(data: StorageData): Promise<void> {
    const updated: StorageData = {
      ...data,
      lastModifiedAt: new Date().toISOString()
    };
    this.ensureUngroupedGroup(updated);
    await this.adapter.save(updated);
    this.data.set(updated);
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

  getData(): StorageData {
    const current = this.data();
    if (current) {
      return current;
    }
    throw new Error('Data not loaded. Call loadData() first.');
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

  async updateSettings(settings: Partial<Settings>): Promise<void> {
    const data = this.getData();
    await this.saveData({
      ...data,
      settings: { ...data.settings, ...settings }
    });
  }
}