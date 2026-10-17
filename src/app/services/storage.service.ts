import { Injectable, signal } from '@angular/core';
import { StorageData } from '../models/storage.model';
import { Item } from '../models/item.model';
import { Group } from '../models/group.model';
import {
  assertSupportedStorageVersion,
  createDefaultStorageData,
  normalizeStorageData,
  UnsupportedSchemaVersionError,
} from '../domain/storage-schema';
import type { DroppedRecords, NormalizationResult } from '../domain/storage-schema';
import type { StoredImage } from './image-storage.service';
import { imagesInvalidated } from './image-invalidation';

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
  private readonly inMemorySession = signal(false);
  private readonly compatibilityError = signal<UnsupportedSchemaVersionError | null>(null);
  private unsupportedData: unknown;
  private database: IDBDatabase | null = null;
  private lastPersistedData: StorageData | null = null;
  private initialization: Promise<void> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  initialize(): Promise<void> {
    this.initialization ??= this.loadData().catch((error: unknown) => {
      if (this.compatibilityError()) return;
      this.initialization = null;
      this.useInMemorySession();
      console.error('Storage initialization failed, falling back to in-memory session:', error);
      const defaults = createDefaultStorageData();
      this.lastPersistedData = cloneStorageData(defaults);
      this.data.set(cloneStorageData(defaults));
    });
    return this.initialization;
  }

  async importData(data: unknown): Promise<StorageData> {
    const normalized = normalizeStorageData(data);
    await this.persistData(normalized.data);
    return this.getData();
  }

  saveData(data: StorageData): Promise<void> {
    return this.persistData(data);
  }

  async importDataWithImages(
    data: unknown,
    images: StoredImage[],
  ): Promise<{ data: StorageData; dropped: DroppedRecords }> {
    const normalized = normalizeStorageData(data);
    await this.persistData(normalized.data, images);
    return { data: this.getData(), dropped: normalized.dropped };
  }

  async writeImages(write: (store: IDBObjectStore) => void) {
    await this.initialize();
    this.assertWritable();
    await this.writeTransaction(
      [STORE_NAME, IMAGE_STORE_NAME],
      (transaction) => write(transaction.objectStore(IMAGE_STORE_NAME)),
      'Failed to update posters',
    );
  }

  getSaveErrorSignal() {
    return this.saveError.asReadonly();
  }

  getInMemorySessionSignal() {
    return this.inMemorySession.asReadonly();
  }

  getCompatibilityErrorSignal() {
    return this.compatibilityError.asReadonly();
  }

  getUnsupportedData() {
    if (!this.compatibilityError()) throw new Error('No incompatible collection is loaded');
    return structuredClone(this.unsupportedData);
  }

  assertWritable() {
    const error = this.compatibilityError();
    if (error) throw error;
  }

  async getRecoveryBackups(): Promise<{ key: string; timestamp: Date }[]> {
    if (!this.database) {
      return [];
    }
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
    if (!this.database) {
      throw new Error('Recovery backup not found');
    }
    const backup = await this.readRecord(key);
    if (backup === undefined) {
      throw new Error('Recovery backup not found');
    }
    return backup;
  }

  private async persistData(data: StorageData, images?: StoredImage[]): Promise<void> {
    if (!this.data()) await this.initialize();
    this.assertWritable();
    assertSupportedStorageVersion(data);
    if (!this.database && images && images.length > 0) {
      throw new Error(
        'Cannot import posters while persistent storage is unavailable. No data was imported.',
      );
    }
    const updated: StorageData = {
      ...cloneStorageData(data),
      lastModifiedAt: new Date().toISOString(),
    };
    const writeSnapshot = cloneStorageData(updated);
    this.saveError.set(null);
    this.data.set(updated);
    if (!this.database) {
      return Promise.resolve();
    }
    const write = this.writeQueue.then(() =>
      images === undefined
        ? this.writeData(writeSnapshot)
        : this.writeDataWithImages(writeSnapshot, images),
    );
    this.writeQueue = write.then(
      () => {
        this.lastPersistedData = cloneStorageData(writeSnapshot);
        this.saveError.set(null);
        if (images !== undefined) imagesInvalidated.next();
      },
      (error: unknown) => {
        if (this.data() === updated) {
          this.data.set(this.lastPersistedData && cloneStorageData(this.lastPersistedData));
        }
        const message = error instanceof Error ? error.message : String(error);
        this.saveError.set(this.compatibilityError() ? null : message);
        console.error(
          images === undefined
            ? 'Failed to save watch-list data:'
            : 'Failed to import watch-list data:',
          error,
        );
      },
    );
    return write;
  }

  getData(): StorageData {
    this.assertWritable();
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
    this.inMemorySession.set(false);
    try {
      const stored = await this.readData();

      if (stored !== undefined) {
        let normalized: NormalizationResult;
        let storedSnapshot: unknown;
        try {
          storedSnapshot = structuredClone(stored);
          normalized = normalizeStorageData(stored);
        } catch (error) {
          if (error instanceof UnsupportedSchemaVersionError) {
            this.lockUnsupportedData(storedSnapshot, error);
            return;
          }
          console.error('Failed to load stored watch-list data:', error);
          const defaults = createDefaultStorageData();
          await this.writeInitialData(defaults, storedSnapshot);
          this.lastPersistedData = cloneStorageData(defaults);
          this.data.set(cloneStorageData(defaults));
          return;
        }

        if (!storageDataEqual(normalized.data, storedSnapshot)) {
          const { groups, items, deletedItems } = normalized.dropped;
          await this.writeInitialData(
            normalized.data,
            groups + items + deletedItems > 0 ? storedSnapshot : undefined,
          );
        }
        this.lastPersistedData = cloneStorageData(normalized.data);
        this.data.set(cloneStorageData(normalized.data));
        return;
      }

      const defaults = createDefaultStorageData();
      await this.writeInitialData(defaults);
      this.lastPersistedData = cloneStorageData(defaults);
      this.data.set(cloneStorageData(defaults));
    } catch {
      if (this.compatibilityError()) return;
      this.useInMemorySession();
      const defaults = createDefaultStorageData();
      this.lastPersistedData = cloneStorageData(defaults);
      this.data.set(cloneStorageData(defaults));
    }
  }

  private useInMemorySession(): void {
    this.database?.close();
    this.database = null;
    this.inMemorySession.set(true);
  }

  private async writeInitialData(data: StorageData, backup?: unknown) {
    try {
      if (backup !== undefined) await this.backupRawData(backup);
      await this.writeData(data);
    } catch (error) {
      if (error instanceof UnsupportedSchemaVersionError) throw error;
      this.useInMemorySession();
    }
  }

  private lockUnsupportedData(raw: unknown, error: UnsupportedSchemaVersionError) {
    this.unsupportedData = structuredClone(raw);
    this.compatibilityError.set(error);
    this.data.set(null);
  }

  private async backupRawData(raw: unknown): Promise<void> {
    if (!this.database) {
      return;
    }
    const key = `${BACKUP_PREFIX}${Date.now()}`;
    const transaction = this.database!.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(raw, key);
    await this.completeTransaction(transaction, 'Failed to back up corrupted data');
    await this.pruneOldBackups();
  }

  private async pruneOldBackups(): Promise<void> {
    if (!this.database) {
      return;
    }
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
    await this.completeTransaction(transaction, 'Failed to prune old backups');
  }

  private async listBackupKeys(): Promise<string[]> {
    if (!this.database) {
      return [];
    }
    const transaction = this.database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAllKeys();
    const allKeys = await this.promisifyRequest(
      request as IDBRequest<IDBValidKey[]>,
      transaction,
      'Failed to list backup keys',
    );
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
    if (!this.database) {
      return Promise.resolve(undefined);
    }
    const transaction = this.database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key) as IDBRequest<unknown | undefined>;
    return this.promisifyRequest(request, transaction, 'IndexedDB read transaction aborted');
  }

  private writeData(data: StorageData): Promise<void> {
    return this.writeTransaction(
      [STORE_NAME],
      (transaction) => transaction.objectStore(STORE_NAME).put(data, DATA_KEY),
      'Failed to write to IndexedDB',
    );
  }

  private writeDataWithImages(data: StorageData, images: StoredImage[]): Promise<void> {
    return this.writeTransaction(
      [STORE_NAME, IMAGE_STORE_NAME],
      (transaction) => {
        transaction.objectStore(STORE_NAME).put(data, DATA_KEY);
        const imageStore = transaction.objectStore(IMAGE_STORE_NAME);
        imageStore.clear();
        for (const image of images) imageStore.put(image);
      },
      'Failed to import watch-list data',
    );
  }

  private writeTransaction(
    stores: string[],
    write: (transaction: IDBTransaction) => void,
    message: string,
  ): Promise<void> {
    if (!this.database) {
      return Promise.reject(new Error('Persistent storage is unavailable'));
    }
    return new Promise((resolve, reject) => {
      const transaction = this.database!.transaction(stores, 'readwrite');
      let failure: unknown;
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(failure ?? transaction.error ?? new Error(message));
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error(message));
      // Reading and writing in one transaction prevents another tab from upgrading
      // the document between the compatibility check and any collection/poster changes.
      const request = transaction.objectStore(STORE_NAME).get(DATA_KEY) as IDBRequest<unknown>;
      request.onsuccess = () => {
        try {
          this.assertWritable();
          try {
            assertSupportedStorageVersion(request.result);
          } catch (error) {
            if (error instanceof UnsupportedSchemaVersionError) {
              this.lockUnsupportedData(request.result, error);
            }
            throw error;
          }
          write(transaction);
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
    });
  }

  private promisifyRequest<T>(
    request: IDBRequest<T>,
    transaction: IDBTransaction,
    abortMessage: string,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error(abortMessage));
    });
  }

  private completeTransaction(transaction: IDBTransaction, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error(message));
      transaction.onabort = () => reject(transaction.error ?? new Error(message));
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
