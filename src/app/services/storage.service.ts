import { Injectable, resource, signal, inject, computed } from '@angular/core';
import { StorageData, Settings } from '../models/storage.model';
import { Item } from '../models/item.model';
import { Group } from '../models/group.model';
import { STORAGE_ADAPTER } from './storage.adapter';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly adapter = inject(STORAGE_ADAPTER);

  readonly dataResource = resource({
    loader: async () => {
      const loaded = await this.adapter.load();
      this.ensureUngroupedGroup(loaded);
      return loaded;
    }
  });

  readonly data = computed(() => this.dataResource.value());
  readonly loading = computed(() => this.dataResource.status() === 'loading');
  readonly error = computed(() => this.dataResource.status() === 'error' ? this.dataResource.error()?.message : null);

  async saveData(newData: StorageData): Promise<void> {
    if (this.loading()) {
      throw new Error('Cannot save while data is loading');
    }
    const updated: StorageData = {
      ...newData,
      lastModifiedAt: new Date().toISOString()
    };
    this.ensureUngroupedGroup(updated);
    await this.adapter.save(updated);
    this.dataResource.set(updated);
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
    throw new Error('Data not loaded');
  }

  getDataSignal() {
    return this.data;
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