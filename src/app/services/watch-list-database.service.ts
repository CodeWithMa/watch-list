import { Injectable, signal } from '@angular/core';

const DATABASE_NAME = 'watch-list';
// Version 2 could be created by poster reads with only the images store.
const DATABASE_VERSION = 3;
const OPEN_TIMEOUT_MS = 5_000;
export const STORAGE_STORE_NAME = 'storage';
export const IMAGE_STORE_NAME = 'images';

export class DatabaseAccessError extends Error {
  constructor(
    readonly recovery: 'retry' | 'reload',
    message: string,
  ) {
    super(message);
    this.name = 'DatabaseAccessError';
  }
}

@Injectable({ providedIn: 'root' })
export class WatchListDatabase {
  private readonly accessError = signal<DatabaseAccessError | null>(null);
  private connection: { promise: Promise<IDBDatabase>; close: () => void } | null = null;

  getAccessErrorSignal() {
    return this.accessError.asReadonly();
  }

  open() {
    const error = this.accessError();
    if (error?.recovery === 'reload') return Promise.reject(error);
    this.connection ??= this.openConnection();
    return this.connection.promise;
  }

  close() {
    this.connection?.close();
  }

  private openConnection() {
    let close: () => void;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      let abandoned = false;
      let database: IDBDatabase | null = null;
      const fail = (error: unknown) => {
        abandoned = true;
        clearTimeout(timeout);
        if (error instanceof DatabaseAccessError && this.connection === connection) {
          this.accessError.set(error);
        }
        reject(error);
      };
      // A retry can queue behind a blocked request without receiving its own blocked event.
      const timeout = setTimeout(
        () =>
          fail(
            new DatabaseAccessError(
              'retry',
              'IndexedDB open request timed out. Close other tabs and retry.',
            ),
          ),
        OPEN_TIMEOUT_MS,
      );
      close = () => {
        database?.close();
        fail(new Error('IndexedDB connection was closed'));
      };
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORAGE_STORE_NAME)) {
          database.createObjectStore(STORAGE_STORE_NAME);
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
        clearTimeout(timeout);
        database = request.result;
        this.accessError.set(null);
        database.onversionchange = () => {
          this.accessError.set(
            new DatabaseAccessError(
              'reload',
              'The collection database changed in another tab. Reload Watch List before making further changes.',
            ),
          );
          connection.close();
        };
        database.onclose = () => connection.close();
        resolve(database);
      };
      request.onerror = () =>
        fail(
          request.error?.name === 'VersionError'
            ? new DatabaseAccessError(
                'reload',
                'This database requires a newer version of Watch List. Update or reload Watch List before editing this collection.',
              )
            : (request.error ?? new Error('Failed to open IndexedDB')),
        );
      request.onblocked = () => {
        fail(
          new DatabaseAccessError(
            'retry',
            'IndexedDB open request is blocked by another open connection. Close other Watch List tabs and retry.',
          ),
        );
      };
    });
    const connection = {
      promise: opening.catch((error: unknown) => {
        connection.close();
        throw error;
      }),
      close: () => {
        close();
        if (this.connection === connection) this.connection = null;
      },
    };
    return connection;
  }
}
