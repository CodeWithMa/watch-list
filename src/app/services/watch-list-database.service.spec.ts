import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WatchListDatabase } from './watch-list-database.service';

describe('WatchListDatabase', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: new IDBFactory(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('allows a fresh connection attempt after an open failure', async () => {
    const owner = new WatchListDatabase();
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });

    await expect(owner.open()).rejects.toThrow('Storage unavailable');
    const database = await owner.open();
    expect([...database.objectStoreNames]).toEqual(['images', 'storage']);
    database.close();
  });

  it('releases an obsolete connection and requires reload after a version change', async () => {
    const owner = new WatchListDatabase();
    const original = await owner.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('watch-list');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Obsolete connection blocked deletion'));
      });
      expect(() => original.transaction('storage')).toThrow();

      expect(owner.getAccessErrorSignal()()?.recovery).toBe('reload');
      await expect(owner.open()).rejects.toThrow(/reload/i);
      const reloadedOwner = new WatchListDatabase();
      const replacement = await reloadedOwner.open();
      expect(replacement).not.toBe(original);
      expect([...replacement.objectStoreNames]).toEqual(['images', 'storage']);
      reloadedOwner.close();
    } finally {
      original.close();
    }
  });

  it('shares one connection while concurrent consumers initialize', async () => {
    const owner = new WatchListDatabase();
    const [metadata, posters] = await Promise.all([owner.open(), owner.open()]);
    expect(metadata).toBe(posters);
    expect(metadata.transaction(['storage', 'images']).objectStore('images').keyPath).toBe('id');
    owner.close();
  });

  it('upgrades an existing metadata database without losing its records', async () => {
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('watch-list', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('storage');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = legacy.transaction('storage', 'readwrite');
    transaction.objectStore('storage').put({ original: true }, 'legacy');
    await new Promise<void>((resolve) => (transaction.oncomplete = () => resolve()));
    legacy.close();

    const owner = new WatchListDatabase();
    const database = await owner.open();
    expect([...database.objectStoreNames]).toEqual(['images', 'storage']);
    const request = database.transaction('storage').objectStore('storage').get('legacy');
    const value = await new Promise<unknown>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    expect(value).toEqual({ original: true });
    owner.close();
  });

  it.each(['storage', 'images'])(
    'repairs a version 2 database containing only %s without losing its records',
    async (store) => {
      const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('watch-list', 2);
        request.onupgradeneeded = () => {
          request.result.createObjectStore(store, store === 'images' ? { keyPath: 'id' } : {});
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const record = { id: 'existing', original: true };
      const transaction = legacy.transaction(store, 'readwrite');
      transaction.objectStore(store).put(record, store === 'storage' ? 'existing' : undefined);
      await new Promise<void>((resolve) => (transaction.oncomplete = () => resolve()));
      legacy.close();

      const owner = new WatchListDatabase();
      const database = await owner.open();
      expect([...database.objectStoreNames]).toEqual(['images', 'storage']);
      const request = database.transaction(store).objectStore(store).get('existing');
      const value = await new Promise<unknown>((resolve) => {
        request.onsuccess = () => resolve(request.result);
      });
      expect(value).toEqual(record);
      owner.close();
    },
  );

  it('rejects a blocked open without reading its pending result and closes a late connection', async () => {
    const owner = new WatchListDatabase();
    const database = { close: vi.fn() } as unknown as IDBDatabase;
    let resultAvailable = false;
    const request = {
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      onblocked: null,
      get result(): IDBDatabase {
        if (!resultAvailable) {
          throw new DOMException('The request is still pending', 'InvalidStateError');
        }
        return database;
      },
    } as unknown as IDBOpenDBRequest;
    vi.spyOn(indexedDB, 'open').mockReturnValueOnce(request);

    const opening = owner.open();
    request.onblocked!({} as IDBVersionChangeEvent);
    await expect(opening).rejects.toThrow('IndexedDB open request is blocked');

    const replacement = await owner.open();
    resultAvailable = true;
    request.onsuccess!(new Event('success'));
    expect(database.close).toHaveBeenCalledOnce();
    expect(await owner.open()).toBe(replacement);
    owner.close();
  });

  it('allows retry after an asynchronous open error', async () => {
    const owner = new WatchListDatabase();
    const request = {
      error: new DOMException('Open failed', 'UnknownError'),
      onerror: null,
    } as unknown as IDBOpenDBRequest;
    vi.spyOn(indexedDB, 'open').mockReturnValueOnce(request);

    const opening = owner.open();
    request.onerror!(new Event('error'));
    await expect(opening).rejects.toThrow('Open failed');
    const database = await owner.open();
    expect([...database.objectStoreNames]).toEqual(['images', 'storage']);
    owner.close();
  });

  it('retries a blocked upgrade once the other connection is released', async () => {
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('watch-list', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('storage');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const owner = new WatchListDatabase();
    try {
      await expect(owner.open()).rejects.toThrow('IndexedDB open request is blocked');
    } finally {
      legacy.close();
    }

    const database = await owner.open();
    expect([...database.objectStoreNames]).toEqual(['images', 'storage']);
    owner.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('watch-list');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Abandoned connection was not closed'));
    });
  });

  it('bounds a retry queued behind a still-blocked open', async () => {
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('watch-list', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('storage');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const owner = new WatchListDatabase();
    try {
      await expect(owner.open()).rejects.toThrow('IndexedDB open request is blocked');
      const retry = expect(owner.open()).rejects.toThrow(/timed out|blocked/);
      await vi.advanceTimersByTimeAsync(10_000);
      await retry;
    } finally {
      owner.close();
      legacy.close();
    }
  });

  it('cancels an in-flight open and closes its late connection without disturbing a retry', async () => {
    const owner = new WatchListDatabase();
    const opening = owner.open();
    const cancelled = expect(opening).rejects.toThrow(/closed/);
    owner.close();
    const replacement = await owner.open();
    await cancelled;
    expect(await owner.open()).toBe(replacement);
    owner.close();

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('watch-list');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Cancelled connection was not closed'));
    });
  });
});
