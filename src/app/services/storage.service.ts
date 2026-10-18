import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageData } from '../models/storage.model';
import { Item, SeasonInfo } from '../models/item.model';
import { Group } from '../models/group.model';
import { isEpisodicType } from '../domain/item.constants';
import {
  assertSupportedStorageVersion,
  createDefaultStorageData,
  normalizeStorageData,
  UnsupportedSchemaVersionError,
} from '../domain/storage-schema';
import type { NormalizationReport, NormalizationResult } from '../domain/storage-schema';
import type { StoredImage } from './image-storage.service';
import { imagesInvalidated } from './image-invalidation';
import {
  WatchListDatabase,
  DatabaseAccessError,
  STORAGE_STORE_NAME as STORE_NAME,
  IMAGE_STORE_NAME,
} from './watch-list-database.service';

const DATA_KEY = 'watch-list-data';
// Local concurrency metadata stays out of portable documents and schema migration.
const REVISION_KEY = 'watch-list-revision';
const BACKUP_PREFIX = 'watch-list-data-backup-';
const BACKUP_LIMIT = 10;

export interface MutationResult<T> {
  value: T;
  durability: 'persistent' | 'session-only';
}

export class CollectionConflictError extends Error {
  constructor(
    message = 'The collection changed in another tab or window. Refresh the collection, review the latest changes, and retry. Your changes were not saved.',
  ) {
    super(message);
    this.name = 'CollectionConflictError';
  }
}

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly databaseOwner = inject(WatchListDatabase);
  private readonly initializationError = signal<DatabaseAccessError | null>(null);
  private readonly databaseError = computed(
    () => this.databaseOwner.getAccessErrorSignal()() ?? this.initializationError(),
  );
  private readonly data = signal<StorageData | null>(null);
  private readonly accessibleData = computed(() =>
    this.loading() || this.databaseError() ? null : this.data(),
  );
  private readonly loading = signal(false);
  private readonly saveError = signal<string | null>(null);
  private readonly visibleSaveError = computed(() =>
    this.databaseError() ? null : this.saveError(),
  );
  private readonly inMemorySession = signal(false);
  private readonly conflict = signal(false);
  private readonly compatibilityError = signal<UnsupportedSchemaVersionError | null>(null);
  private unsupportedData: unknown;
  private persistentStorage = false;
  private lastPersistedData: StorageData | null = null;
  private settledData: StorageData | null = null;
  private revision: unknown = undefined;
  private readonly refreshing = signal(false);
  private importContext = Symbol();
  private readonly pendingSaves = new Set<{
    apply: (settled: StorageData) => StorageData;
    requiresImages: boolean;
  }>();
  private initialization: Promise<void> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  initialize(): Promise<void> {
    const retryingAccess = this.databaseError()?.recovery === 'retry';
    if (retryingAccess && !this.loading()) this.initialization = null;
    if (!this.initialization) {
      this.loading.set(true);
      this.initializationError.set(null);
      // Poster reads can recover independently, so preserve edits even after their error clears.
      const preserveSession =
        this.inMemorySession() &&
        this.data() &&
        (retryingAccess || !storageDataEqual(this.data(), this.lastPersistedData));
      const initialization = preserveSession
        ? this.databaseOwner.open().then(() => undefined)
        : this.loadData();
      this.initialization = initialization
        .catch((error: unknown) => {
          if (this.compatibilityError()) return;
          this.initialization = null;
          const accessError = error instanceof DatabaseAccessError ? error : this.databaseError();
          if (accessError) {
            this.initializationError.set(accessError);
            return;
          }
          this.useInMemorySession();
          console.error('Storage initialization failed, falling back to in-memory session:', error);
          if (preserveSession) return;
          const defaults = createDefaultStorageData();
          this.publishLoadedData(defaults);
        })
        .finally(() => this.loading.set(false));
    }
    return this.initialization;
  }

  getDatabaseErrorSignal() {
    return this.databaseError;
  }

  getLoadingSignal() {
    return this.loading.asReadonly();
  }

  async importData(data: unknown): Promise<StorageData> {
    const normalized = normalizeStorageData(data);
    await this.persistData(normalized.data);
    return this.getData();
  }

  async saveData(data: StorageData): Promise<void> {
    return this.persistData(validateSaveData(data));
  }

  /**
   * Legacy item workflows still publish optimistically until their intent migration.
   * Capture only the item/history field changes relative to the visible snapshot. At
   * the queue slot, rebase those changes onto settled state, retaining preceding watch
   * commands and groups, including nested progress and seasons keyed by season number.
   * Edits whose base disappeared reject; deletion archives the latest settled history.
   * Group references deleted by preceding commands are repaired during normalization.
   * Import/recovery remain explicit whole-collection replacement operations.
   */
  async saveItemChanges({ items, deletedItems }: Pick<StorageData, 'items' | 'deletedItems'>) {
    const before = this.getData();
    const after = validateSaveData({ ...before, items, deletedItems });
    return this.persistData(after, {
      rebaseItems: (settled) => rebaseItemChanges(before, after, settled),
    });
  }

  /**
   * Intents and legacy snapshot writes share invocation order in this service instance.
   * An intent edits a detached draft of the latest successful state after earlier writes settle.
   * Keep the callback synchronous and side-effect free. Rejection discards its entire draft;
   * Success republishes committed state after transaction completion (or explicitly as
   * session-only), projecting remaining legacy edits without withholding settled changes.
   * Legacy item saves rebase their changed fields; snapshot saves/imports replace the collection.
   * Both legacy paths may publish optimistically until migrated.
   */
  async mutate<T>(intent: (draft: StorageData) => T): Promise<MutationResult<T>> {
    this.assertMutationReady();
    const mutation = this.writeQueue.then(async () => {
      if (this.conflict()) throw new CollectionConflictError();
      this.assertWritable();
      if (this.loading() || !this.data()) await this.initialize();
      this.assertWritable();
      const draft = cloneStorageData(this.settledData ?? this.getData());
      const value = intent(draft);
      const updated = { ...validateSaveData(draft), lastModifiedAt: new Date().toISOString() };
      if (this.persistentStorage) await this.writeData(updated);
      this.recordSuccessfulWrite(updated);
      this.publishPendingData();
      return { value, durability: this.persistentStorage ? 'persistent' : 'session-only' } as const;
    });
    this.writeQueue = mutation.then(
      () => undefined,
      (error: unknown) => this.reportSaveFailure(error),
    );
    return mutation;
  }

  /** Bind asynchronous file preparation to the context in which import was confirmed. */
  captureImportContext() {
    this.assertMutationReady();
    return this.importContext;
  }

  async importDataWithImages(
    data: unknown,
    images: StoredImage[],
    expectedContext = this.importContext,
  ): Promise<NormalizationResult> {
    if (expectedContext !== this.importContext) {
      throw new CollectionConflictError(
        'The collection was refreshed while preparing this import. Review the latest collection and confirm the import again. No data was imported.',
      );
    }
    const normalized = normalizeStorageData(data);
    await this.persistData(normalized.data, { images });
    return { ...normalized, data: this.getData() };
  }

  async writeImages(write: (store: IDBObjectStore) => void) {
    this.assertMutationReady();
    this.assertWritable();
    await this.initialize();
    this.assertWritable();
    await this.writeTransaction(
      [STORE_NAME, IMAGE_STORE_NAME],
      (transaction) => write(transaction.objectStore(IMAGE_STORE_NAME)),
      'Failed to update posters',
    );
  }

  getSaveErrorSignal() {
    return this.visibleSaveError;
  }

  getInMemorySessionSignal() {
    return this.inMemorySession.asReadonly();
  }

  getConflictSignal() {
    return this.conflict.asReadonly();
  }

  getRefreshingSignal() {
    return this.refreshing.asReadonly();
  }

  /** Refresh committed state in place: mounted forms keep ownership of their drafts. */
  refresh(): Promise<void> {
    if (this.refreshing())
      return Promise.reject(new Error('The collection is already refreshing.'));
    this.refreshing.set(true);
    this.importContext = Symbol();
    const refresh = this.writeQueue
      .then(async () => {
        this.assertWritable();
        if (!this.persistentStorage) {
          throw new Error('Session-only changes cannot be refreshed from shared storage.');
        }
        const previousRevision = this.revision;
        try {
          await this.loadData(false);
          this.assertWritable();
          this.conflict.set(false);
          this.saveError.set(null);
          imagesInvalidated.next();
        } catch (error) {
          this.revision = previousRevision;
          throw error;
        }
      })
      .finally(() => {
        this.refreshing.set(false);
      });
    this.writeQueue = refresh.then(
      () => undefined,
      (error: unknown) => this.reportSaveFailure(error, 'Failed to refresh collection:'),
    );
    return refresh;
  }

  private assertMutationReady() {
    if (this.refreshing())
      throw new Error(
        'The collection is refreshing. Review the latest changes and retry when it finishes.',
      );
    if (this.conflict()) throw new CollectionConflictError();
  }

  getCompatibilityErrorSignal() {
    return this.compatibilityError.asReadonly();
  }

  getUnsupportedData() {
    if (!this.compatibilityError()) throw new Error('No incompatible collection is loaded');
    return structuredClone(this.unsupportedData);
  }

  assertWritable() {
    const error = this.compatibilityError() ?? this.databaseError();
    if (error) throw error;
  }

  async getRecoveryBackups(): Promise<{ key: string; timestamp: Date }[]> {
    if (!this.persistentStorage) {
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
    if (!this.persistentStorage) {
      throw new Error('Recovery backup not found');
    }
    const backup = await this.readRecord(key);
    if (backup === undefined) {
      throw new Error('Recovery backup not found');
    }
    return backup;
  }

  private persistData(
    data: StorageData,
    {
      images,
      rebaseItems,
    }: {
      images?: StoredImage[];
      rebaseItems?: (settled: StorageData) => StorageData;
    } = {},
  ): Promise<void> {
    this.assertMutationReady();
    this.assertWritable();
    assertSupportedStorageVersion(data);
    const updated: StorageData = {
      ...cloneStorageData(data),
      lastModifiedAt: new Date().toISOString(),
    };
    const pending = {
      apply: (settled: StorageData) =>
        rebaseItems ? { ...rebaseItems(settled), lastModifiedAt: updated.lastModifiedAt } : updated,
      requiresImages: !!images?.length,
    };
    const assertImagesAvailable = () => {
      if (!this.persistentStorage && images && images.length > 0) {
        throw new Error(
          'Cannot import posters while persistent storage is unavailable. No data was imported.',
        );
      }
    };
    const ready = !this.loading() && !!this.data();
    if (ready) assertImagesAvailable();
    this.pendingSaves.add(pending);
    if (ready) {
      this.saveError.set(null);
      this.publishPendingData();
    }
    let writeSnapshot = cloneStorageData(updated);
    // Reserve the queue slot before awaiting startup, just as mutate does.
    const write = this.writeQueue.then(async () => {
      if (this.loading() || !this.data()) await this.initialize();
      this.assertWritable();
      assertImagesAvailable();
      if (!ready) this.saveError.set(null);
      this.publishPendingData();
      writeSnapshot = pending.apply(this.settledData ?? this.getData());
      if (!this.persistentStorage) return;
      await (images === undefined
        ? this.writeData(writeSnapshot)
        : this.writeDataWithImages(writeSnapshot, images));
    });
    this.writeQueue = write.then(
      () => {
        this.pendingSaves.delete(pending);
        this.recordSuccessfulWrite(writeSnapshot);
        this.publishPendingData();
        if (images !== undefined) imagesInvalidated.next();
      },
      (error: unknown) => {
        this.pendingSaves.delete(pending);
        this.publishPendingData();
        this.reportSaveFailure(
          error,
          images === undefined
            ? 'Failed to save watch-list data:'
            : 'Failed to import watch-list data:',
        );
      },
    );
    return write;
  }

  getData(): StorageData {
    this.assertWritable();
    const data = this.accessibleData();
    if (!data) throw new Error('The collection is still opening. Please try again.');
    return cloneStorageData(data);
  }

  private recordSuccessfulWrite(data: StorageData) {
    this.settledData = cloneStorageData(data);
    if (this.persistentStorage) this.lastPersistedData = cloneStorageData(data);
    this.saveError.set(null);
  }

  private publishPendingData() {
    if (!this.settledData || this.compatibilityError()) return;
    let visible = this.settledData;
    // Reapply only pending legacy intent over each new committed state. Explicit
    // replacements still supersede earlier state; item edits retain unrelated changes.
    for (const pending of this.pendingSaves) {
      if (pending.requiresImages && !this.persistentStorage) continue;
      try {
        visible = pending.apply(visible);
      } catch {
        // A dependent edit may have lost its base. It must neither resurrect it in
        // the UI nor hide settled commands; its own queue slot will reject the write.
      }
    }
    this.data.set(cloneStorageData(visible));
  }

  private reportSaveFailure(error: unknown, message = 'Failed to save watch-list data:') {
    this.saveError.set(
      this.compatibilityError() ? null : error instanceof Error ? error.message : String(error),
    );
    console.error(message, error);
  }

  private publishLoadedData(data: StorageData) {
    this.lastPersistedData = cloneStorageData(data);
    this.settledData = cloneStorageData(data);
    this.publishPendingData();
  }

  getDataSignal() {
    return this.accessibleData;
  }

  getItems(): Item[] {
    const data = this.getData();
    return Object.values(data.items);
  }

  getGroups(): Group[] {
    const data = this.getData();
    return Object.values(data.groups).sort((a, b) => a.order - b.order);
  }

  private async loadData(allowSessionFallback = true): Promise<void> {
    await this.databaseOwner.open();
    this.persistentStorage = true;
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
          await this.writeInitialData(defaults, storedSnapshot, allowSessionFallback);
          this.publishLoadedData(defaults);
          return;
        }

        if (this.revision === undefined || !storageDataEqual(normalized.data, storedSnapshot)) {
          await this.writeInitialData(
            normalized.data,
            requiresRecovery(normalized) ? storedSnapshot : undefined,
            allowSessionFallback,
          );
        }
        this.publishLoadedData(normalized.data);
        return;
      }

      const defaults = createDefaultStorageData();
      await this.writeInitialData(defaults, undefined, allowSessionFallback);
      this.publishLoadedData(defaults);
    } catch (error) {
      if (this.compatibilityError()) return;
      // Another initializer may have won the first revision or normalization write.
      // Read its committed state rather than publishing defaults or a stale snapshot.
      if (error instanceof CollectionConflictError) return this.loadData(allowSessionFallback);
      if (!allowSessionFallback) throw error;
      if (this.databaseError()) throw error;
      this.useInMemorySession();
      const defaults = createDefaultStorageData();
      this.publishLoadedData(defaults);
    }
  }

  private useInMemorySession(): void {
    this.databaseOwner.close();
    this.persistentStorage = false;
    this.inMemorySession.set(true);
  }

  private async writeInitialData(data: StorageData, backup?: unknown, allowSessionFallback = true) {
    try {
      if (backup !== undefined) await this.backupRawData(backup);
      await this.writeData(data);
    } catch (error) {
      if (
        error instanceof UnsupportedSchemaVersionError ||
        error instanceof CollectionConflictError ||
        !allowSessionFallback ||
        this.databaseError()
      )
        throw error;
      this.useInMemorySession();
    }
  }

  private lockUnsupportedData(raw: unknown, error: UnsupportedSchemaVersionError) {
    this.unsupportedData = structuredClone(raw);
    this.compatibilityError.set(error);
    this.data.set(null);
  }

  private async backupRawData(raw: unknown): Promise<void> {
    if (!this.persistentStorage) {
      return;
    }
    const key = `${BACKUP_PREFIX}${Date.now()}`;
    const database = await this.databaseOwner.open();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(raw, key);
    await this.completeTransaction(transaction, 'Failed to back up corrupted data');
    await this.pruneOldBackups();
  }

  private async pruneOldBackups(): Promise<void> {
    if (!this.persistentStorage) {
      return;
    }
    const keys = await this.listBackupKeys();
    if (keys.length <= BACKUP_LIMIT) {
      return;
    }
    const toDelete = keys.slice(BACKUP_LIMIT);
    const database = await this.databaseOwner.open();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const key of toDelete) {
      store.delete(key);
    }
    await this.completeTransaction(transaction, 'Failed to prune old backups');
  }

  private async listBackupKeys(): Promise<string[]> {
    if (!this.persistentStorage) {
      return [];
    }
    const database = await this.databaseOwner.open();
    const transaction = database.transaction(STORE_NAME, 'readonly');
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

  private async readData(): Promise<unknown | undefined> {
    const database = await this.databaseOwner.open();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const data = store.get(DATA_KEY) as IDBRequest<unknown>;
    const revision = store.get(REVISION_KEY) as IDBRequest<unknown>;
    const result = await this.promisifyRequest(data, transaction, 'Failed to read collection');
    this.revision = revision.result;
    return result;
  }

  private async readRecord(key: string): Promise<unknown | undefined> {
    if (!this.persistentStorage) {
      return undefined;
    }
    const database = await this.databaseOwner.open();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key) as IDBRequest<unknown | undefined>;
    return this.promisifyRequest(request, transaction, 'IndexedDB read transaction aborted');
  }

  private writeData(data: StorageData): Promise<void> {
    return this.writeTransaction(
      [STORE_NAME],
      (transaction) => transaction.objectStore(STORE_NAME).put(data, DATA_KEY),
      'Failed to write to IndexedDB',
      true,
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
      true,
    );
  }

  private async writeTransaction(
    stores: string[],
    write: (transaction: IDBTransaction) => void,
    message: string,
    advancesRevision = false,
  ): Promise<void> {
    if (!this.persistentStorage) {
      throw new Error('Persistent storage is unavailable');
    }
    const database = await this.databaseOwner.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(stores, 'readwrite');
      const nextRevision = advancesRevision ? crypto.randomUUID() : this.revision;
      let failure: unknown;
      transaction.oncomplete = () => {
        if (advancesRevision) this.revision = nextRevision;
        resolve();
      };
      transaction.onerror = () => reject(failure ?? transaction.error ?? new Error(message));
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error(message));
      // Reading and writing in one transaction prevents another tab from upgrading
      // the document between the compatibility check and any collection/poster changes.
      const request = transaction.objectStore(STORE_NAME).get(DATA_KEY) as IDBRequest<unknown>;
      const revision = transaction.objectStore(STORE_NAME).get(REVISION_KEY) as IDBRequest<unknown>;
      revision.onsuccess = () => {
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
          if (revision.result !== this.revision) {
            if (this.settledData) this.conflict.set(true);
            throw new CollectionConflictError();
          }
          write(transaction);
          if (advancesRevision) {
            transaction.objectStore(STORE_NAME).put(nextRevision, REVISION_KEY);
          }
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
      transaction.oncomplete = () => resolve(request.result);
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

function rebaseItemChanges(before: StorageData, after: StorageData, settled: StorageData) {
  const items = applyRecordChanges(before.items, after.items, settled.items, rebaseItem);
  const deletedItems = applyRecordChanges(
    before.deletedItems ?? {},
    after.deletedItems ?? {},
    settled.deletedItems ?? {},
  );
  for (const id of Object.keys(before.items)) {
    const removed = Object.hasOwn(settled.items, id) ? settled.items[id] : undefined;
    if (!Object.hasOwn(after.items, id) && Object.hasOwn(deletedItems, id) && removed) {
      deletedItems[id] = {
        ...deletedItems[id],
        itemTitle: removed.title,
        itemType: removed.type,
        watchHistory: removed.watchHistory,
      };
    }
  }
  return normalizeStorageData({ ...settled, items, deletedItems }).data;
}

function applyRecordChanges<T extends object>(
  before: Record<string, T>,
  after: Record<string, T>,
  settled: Record<string, T>,
  merge: (before: T, after: T, settled: T) => T = applyChangedFields,
) {
  const result = new Map(Object.entries(settled));
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!Object.hasOwn(after, id)) {
      result.delete(id);
    } else if (!Object.hasOwn(before, id)) {
      result.set(id, after[id]);
    } else if (!storageDataEqual(before[id], after[id])) {
      const current = result.get(id);
      if (!current) {
        throw new Error('The edited item no longer exists. Refresh the item list and try again.');
      }
      result.set(id, merge(before[id], after[id], current));
    }
  }
  return Object.fromEntries(result);
}

function applyChangedFields<T extends object>(before: T, after: T, settled: T) {
  const result = { ...settled };
  const fields = Object.keys({ ...before, ...after }) as (keyof T)[];
  for (const field of fields) {
    if (storageDataEqual(before[field], after[field])) continue;
    if (Object.hasOwn(after, field)) result[field] = after[field];
    else delete result[field];
  }
  return result;
}

function rebaseItem(before: Item, after: Item, settled: Item) {
  const result = applyChangedFields(before, after, settled);
  const previousProgress =
    before.progress ??
    (isEpisodicType(before.type) ? { season: 1, episode: 1, seasons: [] } : undefined);
  if (previousProgress && after.progress && settled.progress) {
    result.progress = applyChangedFields(previousProgress, after.progress, settled.progress);
    result.progress.seasons = Object.values(
      applyRecordChanges(
        seasonRecords(previousProgress.seasons),
        seasonRecords(after.progress.seasons),
        seasonRecords(settled.progress.seasons),
      ),
    );
  }
  return result;
}

function seasonRecords(seasons: SeasonInfo[]) {
  return Object.fromEntries(seasons.map((season) => [season.seasonNumber, season]));
}

function validateSaveData(data: StorageData) {
  const normalized = normalizeStorageData(data);
  if (requiresRecovery(normalized)) {
    throw new Error('Invalid collection data. No changes were saved.');
  }
  return normalized.data;
}

function requiresRecovery(report: NormalizationReport) {
  const { groups, items, deletedItems } = report.dropped;
  return groups + items + deletedItems + report.repairedGroupReferences > 0;
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
