import { IStorageAdapter } from './storage.adapter';
import { StorageData } from '../models/storage.model';
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { migrateDataOnly, ensureUngroupedGroup, createDefaultData } from '../shared/data-migration';

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
        const defaultData = createDefaultData();
        await this.save(defaultData);
        return defaultData;
      }

      const content = await readTextFile(path, { baseDir: BaseDirectory.AppData });
      const parsed = JSON.parse(content) as StorageData;

      const migrated = migrateDataOnly(parsed);
      ensureUngroupedGroup(migrated);

      this.cache = migrated;
      await this.save(migrated);

      return migrated;
    } catch (error) {
      console.error('Failed to load file data:', error);
      return createDefaultData();
    }
  }

  async save(data: StorageData): Promise<void> {
    await this.ensureDir();

    const path = `${STORAGE_DIR}/${STORAGE_FILE}`;
    await writeTextFile(path, JSON.stringify(data, null, 2), { baseDir: BaseDirectory.AppData });

    this.cache = data;
  }

  loadSync(): StorageData {
    if (this.cache) {
      return this.cache;
    }
    throw new Error('Data not loaded. Call load() first.');
  }
}
