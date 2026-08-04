import { Injectable, signal } from '@angular/core';
import { StorageData } from '../models/storage.model';
import { Item } from '../models/item.model';
import { Group } from '../models/group.model';
import { createDefaultStorageData, normalizeStorageData } from '../domain/storage-schema';

const DATABASE_NAME = 'watch-list';
const DATABASE_VERSION = 1;
const STORE_NAME = 'storage';
const DATA_KEY = 'watch-list-data';
const BACKUP_KEY = 'watch-list-data-backup';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly data = signal<StorageData | null>(null);
  private readonly saveError = signal<string | null>(null);
  private database: IDBDatabase | null = null;
  private lastPersistedData: StorageData | null = null;
  private initialization: Promise<void> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  initialize(): Promise<void> {
    this.initialization ??= this.loadData().catch((error: unknown) => {
      this.initialization = null;
      this.database?.close();
      this.database = null;
      throw error;
    });
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

  getSaveErrorSignal() {
    return this.saveError.asReadonly();
  }

  async getRecoveryBackup(): Promise<unknown> {
    const backup = await this.readRecord(BACKUP_KEY);
    if (backup === undefined) {
      throw new Error('No recovery backup is available');
    }
    return backup;
  }

  private persistData(data: StorageData): Promise<void> {
    const updated: StorageData = {
      ...cloneStorageData(data),
      lastModifiedAt: new Date().toISOString(),
    };
    const writeSnapshot = cloneStorageData(updated);
    this.saveError.set(null);
    this.data.set(updated);
    const write = this.writeQueue.then(() => this.writeData(writeSnapshot));
    this.writeQueue = write.then(
      () => {
        this.lastPersistedData = cloneStorageData(updated);
        this.saveError.set(null);
      },
      (error: unknown) => {
        if (this.data() === updated) {
          this.data.set(this.lastPersistedData && cloneStorageData(this.lastPersistedData));
        }
        const message = error instanceof Error ? error.message : String(error);
        this.saveError.set(message);
        console.error('Failed to save watch-list data:', error);
      },
    );
    return write;
  }

  getData(): StorageData {
    return cloneStorageData(this.data()!);
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

    if (stored !== undefined) {
      let normalized: StorageData;
      let storedSnapshot: unknown;
      try {
        storedSnapshot = structuredClone(stored);
        normalized = normalizeStorageData(stored);
      } catch (error) {
        console.error('Failed to load stored watch-list data:', error);
        await this.backupRawData(stored);
        const defaults = createDefaultStorageData();
        await this.writeData(defaults);
        this.lastPersistedData = cloneStorageData(defaults);
        this.data.set(cloneStorageData(defaults));
        return;
      }

      if (!storageDataEqual(normalized, storedSnapshot)) {
        await this.writeData(normalized);
      }
      this.lastPersistedData = cloneStorageData(normalized);
      this.data.set(cloneStorageData(normalized));
      return;
    }

    const defaults = createDefaultStorageData();
    await this.writeData(defaults);
    this.lastPersistedData = cloneStorageData(defaults);
    this.data.set(cloneStorageData(defaults));
  }

  private async backupRawData(raw: unknown): Promise<void> {
    const transaction = this.database!.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(raw, BACKUP_KEY);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Failed to back up corrupted data'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Backup transaction was aborted'));
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      let abandoned = false;

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        if (abandoned) {
          request.result.close();
          return;
        }
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
      request.onblocked = () => {
        abandoned = true;
        reject(new Error('IndexedDB open request is blocked by another open connection'));
      };
    });
  }

  private readData(): Promise<unknown | undefined> {
    return this.readRecord(DATA_KEY);
  }

  private readRecord(key: string): Promise<unknown | undefined> {
    const request = this.getStore('readonly').get(key) as IDBRequest<unknown | undefined>;
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

function cloneStorageData(data: StorageData): StorageData {
  return structuredClone(data);
}

function storageDataEqual(
  left: unknown,
  right: unknown,
  seen = new WeakMap<object, object>(),
): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  if (left.constructor !== right.constructor) {
    return false;
  }

  const previousRight = seen.get(left);
  if (previousRight) {
    return previousRight === right;
  }
  seen.set(left, right);

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(rightRecord, key) &&
      storageDataEqual(leftRecord[key], rightRecord[key], seen),
  );
}
