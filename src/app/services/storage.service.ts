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

  constructor() {
    this.loadData();
  }

  async loadData(): Promise<StorageData> {
    const loaded = await this.adapter.load();
    this.data.set(loaded);
    return loaded;
  }

  async saveData(data: StorageData): Promise<void> {
    await this.adapter.save(data);
    this.data.set(data);
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