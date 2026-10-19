import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageData } from '../models/storage.model';
import { DeepReadonly, freezeReadModel } from '../models/readonly';
import {
  assertSupportedStorageVersion,
  createDefaultStorageData,
  normalizeStorageData,
  UnsupportedSchemaVersionError,
} from '../domain/storage-schema';
import type { NormalizationReport, NormalizationResult } from '../domain/storage-schema';
import type { StoredImage } from './image-storage.service';
import { removeUnavailablePosterReferences } from '../domain/poster-references';
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
  private readonly data = signal<DeepReadonly<StorageData> | null>(null);
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
  private initialization: Promise<void> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly provisionalImages = new Map<string, StoredImage>();

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
    await this.replaceData(normalized.data);
    return this.getData();
  }

  /** Explicit validated collection replacement for import/recovery, retaining existing posters. */
  async replaceData(data: StorageData) {
    return this.enqueueMutation(() => undefined, {
      replacement: validateSaveData(data),
    });
  }

  /**
   * Commands and explicit replacements share invocation order in this service instance.
   * An intent edits a detached draft of the latest successful state after earlier writes settle.
   * Keep the callback synchronous and side-effect free. Rejection discards its entire draft;
   * success publishes only after transaction completion (or explicitly as session-only).
   */
  async mutate<T>(intent: (draft: StorageData) => T): Promise<MutationResult<T>> {
    return this.enqueueMutation(intent);
  }

  stageImage(image: StoredImage) {
    this.assertMutationReady();
    this.assertWritable();
    this.provisionalImages.set(image.id, image);
  }

  getProvisionalImage(id: string) {
    return this.provisionalImages.get(id);
  }

  discardProvisionalImage(id: string) {
    return this.provisionalImages.delete(id);
  }

  /** Capture the blob at command invocation: form destruction can only release its draft,
   * never the command's copy. The image and its first committed reference share a transaction.
   * A rejected command leaves a mounted form's draft available for explicit retry.
   */
  mutateWithPoster<T>(intent: (draft: StorageData) => T, posterId?: string) {
    return this.enqueueMutation(intent, {
      posterId,
      poster: posterId ? this.provisionalImages.get(posterId) : undefined,
    });
  }

  private async enqueueMutation<T>(
    intent: (draft: StorageData) => T,
    {
      posterId,
      poster,
      replacement,
      images,
    }: {
      posterId?: string;
      poster?: StoredImage;
      replacement?: StorageData;
      images?: StoredImage[];
    } = {},
  ): Promise<MutationResult<T> & { posterCleanupSkipped?: boolean }> {
    this.assertMutationReady();
    const mutation = this.writeQueue.then(async () => {
      if (this.conflict()) throw new CollectionConflictError();
      this.assertWritable();
      if (this.loading() || !this.data()) await this.initialize();
      this.assertWritable();
      const draft = cloneStorageData(replacement ?? this.settledData ?? this.getData());
      const value = intent(draft);
      const updated = { ...validateSaveData(draft), lastModifiedAt: new Date().toISOString() };
      if (posterId && !this.persistentStorage) {
        throw new Error(
          'Cannot save a poster while persistent storage is unavailable. Please retry.',
        );
      }
      if (images?.length && !this.persistentStorage) {
        throw new Error(
          'Cannot import posters while persistent storage is unavailable. No data was imported.',
        );
      }
      let posterCleanupSkipped = false;
      if (this.persistentStorage) {
        if (posterId) await this.writeDataWithPoster(updated, posterId, poster);
        else if (images !== undefined)
          posterCleanupSkipped = await this.writeDataWithImages(updated, images);
        else await this.writeData(updated);
      }
      this.recordSuccessfulWrite(updated);
      this.publishSettledData();
      if (poster) {
        if (this.provisionalImages.get(poster.id) === poster)
          this.provisionalImages.delete(poster.id);
        imagesInvalidated.next();
      }
      if (images !== undefined) imagesInvalidated.next();
      return {
        value,
        durability: this.persistentStorage ? 'persistent' : 'session-only',
        ...(posterCleanupSkipped ? { posterCleanupSkipped: true } : {}),
      } as const;
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
  ) {
    if (expectedContext !== this.importContext) {
      throw new CollectionConflictError(
        'The collection was refreshed while preparing this import. Review the latest collection and confirm the import again. No data was imported.',
      );
    }
    const normalized = normalizeStorageData(data);
    const availableIds = new Set(images.map((image) => image.id));
    const omittedPosterIds = removeUnavailablePosterReferences(normalized.data.items, availableIds);
    const result = await this.enqueueMutation(() => undefined, {
      replacement: normalized.data,
      images: images.map((image) => ({ ...image })),
    });
    return {
      ...normalized,
      data: this.getData(),
      durability: result.durability,
      omittedPosterIds,
      ...(result.posterCleanupSkipped ? { posterCleanupSkipped: true } : {}),
    };
  }

  writeImages(write: (store: IDBObjectStore) => void) {
    return this.enqueueImageWrite(write, true);
  }

  private async enqueueImageWrite<T>(write: (store: IDBObjectStore) => T, reportFailure: boolean) {
    this.assertMutationReady();
    this.assertWritable();
    // Reserve the same queue as collection commands before awaiting initialization.
    const mutation = this.writeQueue.then(async () => {
      if (this.conflict()) throw new CollectionConflictError();
      await this.initialize();
      this.assertWritable();
      let value!: T;
      await this.writeTransaction(
        [STORE_NAME, IMAGE_STORE_NAME],
        (transaction) => {
          value = write(transaction.objectStore(IMAGE_STORE_NAME));
        },
        'Failed to update posters',
      );
      if (reportFailure) this.saveError.set(null);
      return value;
    });
    this.writeQueue = mutation.then(
      () => undefined,
      (error: unknown) => {
        if (reportFailure) this.reportSaveFailure(error, 'Failed to update posters:');
      },
    );
    return mutation;
  }

  /** Only unreferenced images may be collected, under the shared revision/transaction lock. */
  deleteUnreferencedImage(id: string) {
    return this.enqueueImageWrite((store) => {
      if (Object.values(this.settledData?.items ?? {}).some((item) => item.posterId === id))
        return false;
      store.delete(id);
      return true;
    }, false);
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

  getData(): StorageData {
    return cloneStorageData(this.getReadModel());
  }

  private recordSuccessfulWrite(data: StorageData) {
    this.settledData = cloneStorageData(data);
    if (this.persistentStorage) this.lastPersistedData = cloneStorageData(data);
    this.saveError.set(null);
  }

  private publishSettledData() {
    if (!this.settledData || this.compatibilityError()) return;
    this.data.set(freezeReadModel(this.settledData));
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
    this.publishSettledData();
  }

  getDataSignal() {
    return this.accessibleData;
  }

  getItems() {
    return freezeReadModel(Object.values(this.getReadModel().items));
  }

  getGroups() {
    return freezeReadModel(
      Object.values(this.getReadModel().groups).sort((a, b) => a.order - b.order),
    );
  }

  private getReadModel() {
    this.assertWritable();
    const data = this.accessibleData();
    if (!data) throw new Error('The collection is still opening. Please try again.');
    return data;
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
    );
  }

  private async writeDataWithImages(data: StorageData, images: StoredImage[]) {
    try {
      await this.writeTransaction(
        [STORE_NAME, IMAGE_STORE_NAME],
        (transaction, abort) => {
          transaction.objectStore(STORE_NAME).put(data, DATA_KEY);
          let imageStore: IDBObjectStore;
          try {
            imageStore = transaction.objectStore(IMAGE_STORE_NAME);
            const clear = imageStore.clear();
            clear.onerror = (event) => {
              event.preventDefault();
              abort(new PosterStorageError(clear.error));
            };
          } catch (error) {
            throw new PosterStorageError(error);
          }
          for (const image of images) imageStore.put(image);
        },
        'Failed to import watch-list data',
      );
      return false;
    } catch (error) {
      // Only a poster-store acquisition/cleanup failure permits metadata-only recovery.
      // Metadata failures, conflicts, and image-containing imports must still reject.
      if (images.length || !(error instanceof PosterStorageError)) throw error;
      await this.writeData(data);
      return true;
    }
  }

  private writeDataWithPoster(
    data: StorageData,
    posterId: string,
    image?: StoredImage,
  ): Promise<void> {
    return this.writeTransaction(
      [STORE_NAME, IMAGE_STORE_NAME],
      (transaction, abort) => {
        const store = transaction.objectStore(IMAGE_STORE_NAME);
        if (image) {
          store.put(image);
          transaction.objectStore(STORE_NAME).put(data, DATA_KEY);
        } else {
          const request = store.get(posterId);
          request.onsuccess = () => {
            try {
              if (!request.result) {
                throw new Error(
                  'The selected poster is no longer available. Choose it again and retry.',
                );
              }
              transaction.objectStore(STORE_NAME).put(data, DATA_KEY);
            } catch (error) {
              abort(error);
            }
          };
        }
      },
      'Failed to save item and poster',
    );
  }

  private async writeTransaction(
    stores: string[],
    write: (transaction: IDBTransaction, abort: (error: unknown) => void) => void,
    message: string,
  ): Promise<void> {
    if (!this.persistentStorage) {
      throw new Error('Persistent storage is unavailable');
    }
    const database = await this.databaseOwner.open();
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction(stores, 'readwrite');
      } catch (error) {
        // No transaction or write has started. A metadata-only import can retry
        // without posters, with the normal revision and compatibility checks.
        throw stores.includes(IMAGE_STORE_NAME) ? new PosterStorageError(error) : error;
      }
      const nextRevision = crypto.randomUUID();
      let failure: unknown;
      const abort = (error: unknown) => {
        failure = error;
        transaction.abort();
      };
      transaction.oncomplete = () => {
        this.revision = nextRevision;
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
          write(transaction, abort);
          transaction.objectStore(STORE_NAME).put(nextRevision, REVISION_KEY);
        } catch (error) {
          abort(error);
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

class PosterStorageError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'Poster cleanup unavailable', { cause });
    this.name = 'PosterStorageError';
  }
}

function cloneStorageData(data: DeepReadonly<StorageData>): StorageData {
  return structuredClone(data) as StorageData;
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
