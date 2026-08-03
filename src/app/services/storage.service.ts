import { Injectable, signal } from '@angular/core';
import { StorageData } from '../models/storage.model';
import { Item } from '../models/item.model';
import { Group } from '../models/group.model';
import { createDefaultStorageData, normalizeStorageData } from '../domain/storage-schema';

const DATABASE_NAME = 'watch-list';
const DATABASE_VERSION = 1;
const STORE_NAME = 'storage';
const DATA_KEY = 'watch-list-data';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly data = signal<StorageData | null>(null);
  private database: IDBDatabase | null = null;
  private initialization: Promise<void> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  initialize(): Promise<void> {
    this.initialization ??= this.loadData();
    return this.initialization;
  }

  async importData(data: unknown): Promise<StorageData> {
    const normalized = normalizeStorageData(data);
    await this.persistData(normalized);
    return this.getData();
  }

  saveData(data: StorageData): void {
    void this.persistData(data);
  }

  private persistData(data: StorageData): Promise<void> {
    const updated: StorageData = {
      ...data,
      lastModifiedAt: new Date().toISOString(),
    };
    this.data.set(updated);
    const write = this.writeQueue.then(() => this.writeData(updated));
    this.writeQueue = write.catch((error: unknown) =>
      console.error('Failed to save watch-list data:', error),
    );
    return write;
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

  private async loadData(): Promise<void> {
    this.database = await this.openDatabase();
    const stored = await this.readData();

    if (stored) {
      this.data.set(normalizeStorageData(stored));
      return;
    }

    const defaultData = createDefaultStorageData();
    this.data.set(defaultData);
    await this.writeData(defaultData);
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    });
  }

  private readData(): Promise<StorageData | undefined> {
    const request = this.getStore('readonly').get(DATA_KEY) as IDBRequest<StorageData | undefined>;
    return this.requestResult(request);
  }

  private writeData(data: StorageData): Promise<void> {
    const transaction = this.database!.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(data, DATA_KEY);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Failed to write to IndexedDB'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
  }

  private getStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.database) {
      throw new Error('Storage has not been initialized');
    }
    return this.database.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  private requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  }
}
