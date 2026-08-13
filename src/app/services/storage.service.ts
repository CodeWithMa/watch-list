import { Injectable, signal } from '@angular/core';
import { StorageData } from '../models/storage.model';
import { Item } from '../models/item.model';
import { Group } from '../models/group.model';
import { createDefaultStorageData, normalizeStorageData } from '../domain/storage-schema';

const DATABASE_NAME = 'watch-list';
const DATABASE_VERSION = 2;
const STORE_NAME = 'storage';
const IMAGE_STORE_NAME = 'images';
const DATA_KEY = 'watch-list-data';
const BACKUP_PREFIX = 'watch-list-data-backup-';
const BACKUP_LIMIT = 10;

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
      console.error('Storage initialization failed, falling back to in-memory session:', error);
      const defaults = createDefaultStorageData();
      this.lastPersistedData = cloneStorageData(defaults);
      this.data.set(cloneStorageData(defaults));
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

  async getRecoveryBackups(): Promise<{ key: string; timestamp: Date }[]> {
    const keys = await this.listBackupKeys();
    return keys
      .map((key) => ({
        key,
        timestamp: new Date(Number(key.slice(BACKUP_PREFIX.length))),
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getRecoveryBackupByKey(key: string): Promise<unknown> {
    if (!key.startsWith(BACKUP_PREFIX)) {
      throw new Error('Invalid backup key');
    }
    const backup = await this.readRecord(key);
    if (backup === undefined) {
      throw new Error('Recovery backup not found');
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
        this.lastPersistedData = cloneStorageData(writeSnapshot);
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
    try {
      const stored = await this.readData();

      if (stored !== undefined) {
        let normalized: StorageData;
        let storedSnapshot: unknown;
        try {
          storedSnapshot = structuredClone(stored);
          normalized = normalizeStorageData(stored);
        } catch (error) {
          console.error('Failed to load stored watch-list data:', error);
          await this.backupRawData(storedSnapshot);
          const defaults = createDefaultStorageData();
          try {
            await this.writeData(defaults);
          } catch {
            this.database?.close();
            this.database = null;
          }
          this.lastPersistedData = cloneStorageData(defaults);
          this.data.set(cloneStorageData(defaults));
          return;
        }

        if (!storageDataEqual(normalized, storedSnapshot)) {
          try {
            await this.writeData(normalized);
          } catch {
            this.database?.close();
            this.database = null;
          }
        }
        this.lastPersistedData = cloneStorageData(normalized);
        this.data.set(cloneStorageData(normalized));
        return;
      }

      const defaults = createDefaultStorageData();
      try {
        await this.writeData(defaults);
      } catch {
        this.database?.close();
        this.database = null;
      }
      this.lastPersistedData = cloneStorageData(defaults);
      this.data.set(cloneStorageData(defaults));
    } catch {
      this.database?.close();
      this.database = null;
      const defaults = createDefaultStorageData();
      this.lastPersistedData = cloneStorageData(defaults);
      this.data.set(cloneStorageData(defaults));
    }
  }

  private async backupRawData(raw: unknown): Promise<void> {
    const key = `${BACKUP_PREFIX}${Date.now()}`;
    const transaction = this.database!.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(raw, key);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Failed to back up corrupted data'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Backup transaction was aborted'));
    });
    await this.pruneOldBackups();
  }

  private async pruneOldBackups(): Promise<void> {
    const keys = await this.listBackupKeys();
    if (keys.length <= BACKUP_LIMIT) {
      return;
    }
    const toDelete = keys.slice(BACKUP_LIMIT);
    const transaction = this.database!.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const key of toDelete) {
      store.delete(key);
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Failed to prune old backups'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Prune transaction was aborted'));
    });
  }

  private async listBackupKeys(): Promise<string[]> {
    const transaction = this.database!.transaction(STORE_NAME, 'readonly');
    const allKeys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = transaction.objectStore(STORE_NAME).getAllKeys();
      request.onsuccess = () => resolve(request.result as IDBValidKey[]);
      request.onerror = () => reject(request.error ?? new Error('Failed to list backup keys'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('List keys transaction aborted'));
    });
    return allKeys
      .filter((k): k is string => typeof k === 'string' && k.startsWith(BACKUP_PREFIX))
      .sort(
        (a, b) => Number(b.slice(BACKUP_PREFIX.length)) - Number(a.slice(BACKUP_PREFIX.length)),
      );
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
        if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
          database.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'id' });
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
    const transaction = this.database!.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key) as IDBRequest<unknown | undefined>;
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('IndexedDB read transaction aborted'));
    });
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
