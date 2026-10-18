import { CURRENT_SCHEMA_VERSION } from '../models/storage.model';
import { StorageService } from './storage.service';
import { IDBFactory, IDBObjectStore as FakeIDBObjectStore } from 'fake-indexeddb';
import { vi, afterEach } from 'vitest';
import { Item } from '../models/item.model';
import { createDefaultStorageData } from '../domain/storage-schema';
import { ImageStorageService } from './image-storage.service';
import { TestBed } from '@angular/core/testing';
import { WatchListDatabase } from './watch-list-database.service';

describe('StorageService', () => {
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

  it('creates a default dataset when storage is empty', async () => {
    const service = createStorageService();
    await service.initialize();
    const data = service.getData();

    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.groups['ungrouped'].name).toBe('Ungrouped');
    expect(data.deletedItems).toEqual({});
    expect(service.getInMemorySessionSignal()()).toBe(false);
  });

  it('allows initialization to be retried after an open failure', async () => {
    const service = createStorageService();
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('Unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(service.getData().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(service.getInMemorySessionSignal()()).toBe(true);

    await service.initialize();
    expect(service.getInMemorySessionSignal()()).toBe(false);
  });

  it('does not publish an empty session when an older tab blocks the database upgrade', async () => {
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('watch-list', 2);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('storage');
        request.result.createObjectStore('images', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const original = dataWithMovie();
    await writeRecord(legacy, original);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = createStorageService();
    try {
      await service.initialize();

      expect(service.getDataSignal()()).toBeNull();
      expect(service.getInMemorySessionSignal()()).toBe(false);
      await expect(service.saveData(createDefaultStorageData())).rejects.toThrow(/another.*tab/);
      expect(await readRecord(legacy, 'watch-list-data')).toEqual(original);

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const retry = service.initialize();
      expect(service.getLoadingSignal()()).toBe(true);
      await vi.advanceTimersByTimeAsync(10_000);
      await retry;
      expect(service.getLoadingSignal()()).toBe(false);
      expect(service.getDataSignal()()).toBeNull();
      expect(service.getDatabaseErrorSignal()()?.message).toContain('timed out');
      expect(service.getInMemorySessionSignal()()).toBe(false);
      vi.useRealTimers();
    } finally {
      legacy.close();
    }

    await service.initialize();
    expect(service.getData()).toEqual(original);
    await service.saveData(withGroup(service.getData(), 'saved-after-retry'));
    const reloaded = createStorageService();
    await reloaded.initialize();
    expect(reloaded.getData().groups['saved-after-retry'].name).toBe('saved-after-retry');
  });

  it.each(['synchronous', 'asynchronous'])(
    'falls back to a writable session when a blocked retry fails with an unrelated %s error',
    async (failure) => {
      const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('watch-list', 2);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('storage');
          request.result.createObjectStore('images', { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const original = dataWithMovie();
      await writeRecord(legacy, original);
      const service = createStorageService();
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        await service.initialize();
        expect(service.getDatabaseErrorSignal()()?.recovery).toBe('retry');
      } finally {
        legacy.close();
      }

      const error = new DOMException('Storage unavailable', 'UnknownError');
      const request = { error, onerror: null } as unknown as IDBOpenDBRequest;
      vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
        if (failure === 'synchronous') throw error;
        return request;
      });
      const retry = service.initialize();
      if (failure === 'asynchronous') request.onerror!(new Event('error'));
      await retry;

      expect(service.getDatabaseErrorSignal()()).toBeNull();
      expect(service.getInMemorySessionSignal()()).toBe(true);
      await service.saveData(withGroup(service.getData(), 'session-edit'));
      expect(service.getData().groups['session-edit'].name).toBe('session-edit');
      const reloaded = createStorageService();
      await reloaded.initialize();
      expect(reloaded.getData()).toEqual(original);
    },
  );

  it('invalidates the loaded collection before a newer tab upgrades the database', async () => {
    const service = createStorageService();
    await service.initialize();
    await service.saveData(dataWithMovie());
    const snapshot = service.getData();
    let collectionVisibleDuringUpgrade = true;
    const future = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('watch-list', 4);
      request.onupgradeneeded = () => {
        collectionVisibleDuringUpgrade = service.getDataSignal()() !== null;
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Obsolete connection blocked the upgrade'));
    });
    try {
      expect(collectionVisibleDuringUpgrade).toBe(false);
      expect(service.getDataSignal()()).toBeNull();
      expect(() => service.getData()).toThrow(/reload/i);
      await expect(service.saveData(withGroup(snapshot, 'stale'))).rejects.toThrow(/reload/i);
      await expect(service.importData(snapshot)).rejects.toThrow(/reload/i);
      await expect(service.importDataWithImages(snapshot, [])).rejects.toThrow(/reload/i);
      const writePosters = vi.fn();
      await expect(service.writeImages(writePosters)).rejects.toThrow(/reload/i);
      expect(writePosters).not.toHaveBeenCalled();
      await service.initialize();
      expect(service.getDataSignal()()).toBeNull();
      expect(service.getSaveErrorSignal()()).toBeNull();
      expect(await readRecord(future, 'watch-list-data')).toEqual(snapshot);
    } finally {
      future.close();
    }
  });

  it('requires an updated app instead of session defaults when a newer database exists at startup', async () => {
    const future = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('watch-list', 4);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('storage');
        request.result.createObjectStore('images', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const original = { schemaVersion: CURRENT_SCHEMA_VERSION + 1, future: ['preserve'] };
    await writeRecord(future, original);
    const service = createStorageService();
    try {
      await service.initialize();

      expect(service.getDataSignal()()).toBeNull();
      expect(service.getDatabaseErrorSignal()()?.recovery).toBe('reload');
      expect(service.getDatabaseErrorSignal()()?.message).toContain('newer version');
      expect(service.getInMemorySessionSignal()()).toBe(false);
      await expect(service.saveData(createDefaultStorageData())).rejects.toThrow(/newer version/i);
      await service.initialize();
      expect(service.getDataSignal()()).toBeNull();
      expect(await readRecord(future, 'watch-list-data')).toEqual(original);
    } finally {
      future.close();
    }
  });

  it('retries a connection timeout even after metadata initialization previously succeeded', async () => {
    const service = createStorageService();
    await service.initialize();
    await service.saveData(dataWithMovie());
    const snapshot = service.getData();
    TestBed.inject(WatchListDatabase).close();
    const blocker = await openTestDatabase();
    const upgradeRequest = indexedDB.open('watch-list', 4);
    const blocked = new Promise<void>((resolve) => (upgradeRequest.onblocked = () => resolve()));
    const upgraded = new Promise<IDBDatabase>((resolve, reject) => {
      upgradeRequest.onsuccess = () => resolve(upgradeRequest.result);
      upgradeRequest.onerror = () => reject(upgradeRequest.error);
    });
    await blocked;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const read = expect(TestBed.inject(ImageStorageService).exportImages()).rejects.toThrow(
        /timed out/,
      );
      await vi.advanceTimersByTimeAsync(10_000);
      await read;
      expect(service.getDataSignal()()).toBeNull();

      const retry = service.initialize();
      expect(service.getLoadingSignal()()).toBe(true);
      await vi.advanceTimersByTimeAsync(10_000);
      await retry;
      expect(service.getDatabaseErrorSignal()()?.recovery).toBe('retry');
      expect(service.getDataSignal()()).toBeNull();
    } finally {
      vi.useRealTimers();
      blocker.close();
    }
    const future = await upgraded;
    try {
      await service.initialize();
      expect(service.getDatabaseErrorSignal()()?.recovery).toBe('reload');
      expect(await readRecord(future, 'watch-list-data')).toEqual(snapshot);
    } finally {
      future.close();
    }
  });

  it.each([false, true])(
    'preserves session edits after independent poster recovery (reopen fails: %s)',
    async (reopenFails) => {
      const service = TestBed.inject(StorageService);
      const images = TestBed.inject(ImageStorageService);
      vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
        throw new Error('Unavailable');
      });
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await service.initialize();
      await service.saveData(withGroup(service.getData(), 'session-edit'));
      const session = service.getData();
      const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('watch-list', 2);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('storage');
          request.result.createObjectStore('images', { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const original = dataWithMovie();
      await writeRecord(legacy, original);
      try {
        await expect(images.exportImages()).rejects.toThrow(/blocked/);
      } finally {
        legacy.close();
      }

      expect(await images.exportImages()).toEqual([]);
      if (reopenFails) {
        TestBed.inject(WatchListDatabase).close();
        vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
          throw new Error('Unavailable again');
        });
      }
      await expect(images.delete('missing-poster')).rejects.toThrow(
        'Persistent storage is unavailable',
      );
      expect(service.getData()).toEqual(session);
      await service.initialize();
      expect(service.getData()).toEqual(session);
      expect(service.getInMemorySessionSignal()()).toBe(true);
      const database = await openTestDatabase();
      try {
        expect(await readRecord(database, 'watch-list-data')).toEqual(original);
      } finally {
        database.close();
      }
    },
  );

  it('closes an opened database when initialization fails', async () => {
    const service = createStorageService();
    const put = vi.spyOn(FakeIDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new Error('Disk full');
    });

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(service.getInMemorySessionSignal()()).toBe(true);
    put.mockRestore();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('watch-list');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Failed connection was not closed'));
    });
  });

  it('loads data persisted by an earlier service instance', async () => {
    const firstService = createStorageService();
    await firstService.initialize();
    await firstService.importData({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
      items: {},
      deletedItems: {},
    });

    const secondService = createStorageService();
    await secondService.initialize();

    expect(secondService.getData().lastModifiedAt).not.toBe('2026-04-01T10:00:00.000Z');
    expect(secondService.getData().groups).toEqual(firstService.getData().groups);
  });

  it('retains season delay through reload and portable JSON import, including legacy imports', async () => {
    const service = createStorageService();
    await service.initialize();
    const item: Item = {
      id: 'delayed',
      title: 'Delayed',
      type: 'series',
      groupId: 'ungrouped',
      status: 'in-progress',
      isAdult: false,
      createdAt: '2026-01-01',
      watchHistory: [],
      progress: {
        season: 1,
        episode: 3,
        seasons: [{ seasonNumber: 1, firstEpisodeAirDate: '2026-10-01', snoozeCount: 2 }],
      },
    };
    await service.saveData({ ...service.getData(), items: { delayed: item } });
    const reloaded = createStorageService();
    await reloaded.initialize();
    expect(reloaded.getData().items['delayed']).toEqual(item);
    const portable: unknown = JSON.parse(JSON.stringify(reloaded.getData()));
    await reloaded.importDataWithImages(portable, []);
    expect(reloaded.getData().items['delayed']).toEqual(item);

    const legacy = reloaded.getData();
    legacy.schemaVersion = 9;
    delete legacy.items['delayed'].progress!.seasons[0].snoozeCount;
    await reloaded.importDataWithImages(legacy, []);
    expect(reloaded.getData().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(reloaded.getData().items['delayed'].progress!.seasons[0].snoozeCount).toBeUndefined();
  });

  it('replaces malformed persisted data with the default dataset', async () => {
    const firstService = createStorageService();
    await firstService.initialize();
    const database = await openTestDatabase();
    const corruptData = { invalid: true };
    await writeRecord(database, corruptData);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const secondService = createStorageService();
    await secondService.initialize();

    expect(secondService.getData()).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
      items: {},
      deletedItems: {},
    });
    expect(error).toHaveBeenCalledWith('Failed to load stored watch-list data:', expect.any(Error));
  });

  it.each([false, true])(
    'preserves a newer document and stays locked instead of recovering to writable defaults (changed shape: %s)',
    async (changedShape) => {
      const initial = createStorageService();
      await initial.initialize();
      const database = await openTestDatabase();
      const supported = dataWithMovie();
      const raw = changedShape
        ? { schemaVersion: CURRENT_SCHEMA_VERSION + 1, collection: { entries: ['future'] } }
        : {
            ...supported,
            schemaVersion: CURRENT_SCHEMA_VERSION + 1,
            futureSettings: { layout: 'timeline' },
            items: {
              movie: { ...supported.items.movie, metadata: { rating: 5 } },
              future: { type: 'interactive', chapters: [{ title: 'Opening' }] },
            },
          };
      await writeRecord(database, raw);
      // Even an unavailable corruption-backup/write path must not turn compatibility into
      // the generic in-memory fallback. This also detects any normalization write.
      const put = vi.spyOn(FakeIDBObjectStore.prototype, 'put').mockImplementation(() => {
        throw new Error('Writes unavailable');
      });
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const service = createStorageService();

      await expect(service.initialize()).resolves.toBeUndefined();
      expect(service.getDataSignal()()).toBeNull();
      expect(service.getInMemorySessionSignal()()).toBe(false);
      expect(service.getCompatibilityErrorSignal()()?.version).toBe(CURRENT_SCHEMA_VERSION + 1);
      expect(service.getUnsupportedData()).toEqual(raw);
      expect(() => service.getData()).toThrow(/newer version of Watch List/);
      await expect(service.saveData(supported)).rejects.toThrow(/newer version of Watch List/);
      await expect(service.importData(supported)).rejects.toThrow(/newer version of Watch List/);
      await expect(service.importDataWithImages(supported, [])).rejects.toThrow(
        /newer version of Watch List/,
      );
      await service.initialize();

      expect(service.getDataSignal()()).toBeNull();
      expect(service.getUnsupportedData()).toEqual(raw);
      expect(await readRecord(database, 'watch-list-data')).toEqual(raw);
      expect(await service.getRecoveryBackups()).toEqual([]);
      expect(put).not.toHaveBeenCalled();
      database.close();
    },
  );

  it('backs up unreadable data to a timestamped key', async () => {
    const firstService = createStorageService();
    await firstService.initialize();
    const database = await openTestDatabase();
    const corruptData = { invalid: true };
    await writeRecord(database, corruptData);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const secondService = createStorageService();
    await secondService.initialize();

    const backups = await secondService.getRecoveryBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0].timestamp).toBeInstanceOf(Date);
    const backup = await readRecord(database, backups[0].key);
    expect(backup).toEqual(corruptData);
  });

  it.each(['save', 'import', 'portable'] as const)(
    'locks an initialized collection instead of overwriting a newer cross-tab document during %s',
    async (operation) => {
      const service = createStorageService();
      await service.initialize();
      const snapshot = service.getData();
      const database = await openTestDatabase();
      const raw = { schemaVersion: CURRENT_SCHEMA_VERSION + 1, futureRecords: ['keep'] };
      await writeRecord(database, raw);
      const image = { id: 'future-poster', futureBytes: [1, 2, 3] };
      const transaction = database.transaction('images', 'readwrite');
      transaction.objectStore('images').put(image);
      await new Promise<void>((resolve) => (transaction.oncomplete = () => resolve()));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const writes = [1, 2].map(() =>
        operation === 'save'
          ? service.saveData(snapshot)
          : operation === 'import'
            ? service.importData(snapshot)
            : service.importDataWithImages(snapshot, [poster('replacement')]),
      );
      const results = await Promise.allSettled(writes);

      expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
      expect(service.getCompatibilityErrorSignal()()?.version).toBe(CURRENT_SCHEMA_VERSION + 1);
      expect(service.getDataSignal()()).toBeNull();
      expect(service.getUnsupportedData()).toEqual(raw);
      expect(service.getInMemorySessionSignal()()).toBe(false);
      expect(service.getSaveErrorSignal()()).toBeNull();
      expect(await readRecord(database, 'watch-list-data')).toEqual(raw);
      const images = database.transaction('images', 'readonly').objectStore('images').getAll();
      const remaining = await new Promise<unknown>((resolve) => {
        images.onsuccess = () => resolve(images.result);
      });
      expect(remaining).toEqual([image]);
      await expect(service.saveData(snapshot)).rejects.toThrow(/newer version of Watch List/);
      database.close();
    },
  );

  it.each(['empty', 'corrupt', 'legacy'] as const)(
    'stays locked when another tab upgrades an %s collection between startup read and write',
    async (state) => {
      const initial = createStorageService();
      await initial.initialize();
      const database = await openTestDatabase();
      await writeRecord(
        database,
        state === 'empty'
          ? undefined
          : state === 'corrupt'
            ? { invalid: true }
            : { ...createDefaultStorageData(), schemaVersion: 9 },
      );
      const raw = { schemaVersion: CURRENT_SCHEMA_VERSION + 1, futureRecords: ['keep'] };
      const upgrade = upgradeAfterNextRead(database, raw);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const service = createStorageService();

      await service.initialize();
      await upgrade;

      expect(service.getCompatibilityErrorSignal()()?.version).toBe(CURRENT_SCHEMA_VERSION + 1);
      expect(service.getInMemorySessionSignal()()).toBe(false);
      expect(service.getDataSignal()()).toBeNull();
      expect(service.getUnsupportedData()).toEqual(raw);
      expect(await readRecord(database, 'watch-list-data')).toEqual(raw);
      database.close();
    },
  );

  it('commits its version check and save atomically with another tab upgrading the collection', async () => {
    const service = createStorageService();
    await service.initialize();
    const database = await openTestDatabase();
    const raw = { schemaVersion: CURRENT_SCHEMA_VERSION + 1, futureRecords: ['keep'] };
    // A separate preflight read would let the upgrade commit before the stale save.
    const upgrade = upgradeAfterNextRead(database, raw);

    await service.saveData(withGroup(service.getData(), 'edited'));
    await upgrade;

    expect(await readRecord(database, 'watch-list-data')).toEqual(raw);
    database.close();
  });

  it('blocks poster changes even when the image service is used before storage initialization', async () => {
    const initial = createStorageService();
    await initial.initialize();
    const database = await openTestDatabase();
    const raw = { ...dataWithMovie(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    await writeRecord(database, raw);
    const transaction = database.transaction('images', 'readwrite');
    const image = { id: 'future-poster', bytes: [1, 2, 3], metadata: { format: 'future' } };
    transaction.objectStore('images').put(image);
    await new Promise<void>((resolve) => (transaction.oncomplete = () => resolve()));
    const service = TestBed.inject(StorageService);
    const images = TestBed.inject(ImageStorageService);
    const fetch = vi.spyOn(globalThis, 'fetch');

    await expect(images.delete('future-poster')).rejects.toThrow(/newer version of Watch List/);
    await expect(images.replaceImages([])).rejects.toThrow(/newer version of Watch List/);
    await expect(images.storeFile(new Blob(['poster'], { type: 'image/png' }))).rejects.toThrow(
      /newer version of Watch List/,
    );
    await expect(images.storeUrl('https://example.com/poster.png')).rejects.toThrow(
      /newer version of Watch List/,
    );

    const request = database.transaction('images', 'readonly').objectStore('images').getAll();
    const remaining = await new Promise<unknown>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    expect(remaining).toEqual([image]);
    expect(await readRecord(database, 'watch-list-data')).toEqual(raw);
    expect(service.getDataSignal()()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    database.close();
  });

  it('refuses document replacement when a write is attempted before initialization', async () => {
    const initial = createStorageService();
    await initial.initialize();
    const database = await openTestDatabase();
    const raw = { schemaVersion: CURRENT_SCHEMA_VERSION + 1, futureRecords: [{ value: 'keep' }] };
    await writeRecord(database, raw);
    const supported = dataWithMovie();

    for (const operation of ['save', 'import', 'portable'] as const) {
      const service = createStorageService();
      const write =
        operation === 'save'
          ? service.saveData(supported)
          : operation === 'import'
            ? service.importData(supported)
            : service.importDataWithImages(supported, [poster('replacement')]);

      await expect(write).rejects.toThrow(/newer version of Watch List/);
      expect(service.getDataSignal()()).toBeNull();
      expect(await readRecord(database, 'watch-list-data')).toEqual(raw);
    }
    database.close();
  });

  it.each(['groups', 'items', 'deletedItems'] as const)(
    'backs up the original dataset when startup drops invalid %s',
    async (collection) => {
      const firstService = createStorageService();
      await firstService.initialize();
      const database = await openTestDatabase();
      const valid = dataWithMovie();
      const raw = { ...valid, [collection]: { ...valid[collection], bad: { invalid: true } } };
      await writeRecord(database, raw);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const recovered = createStorageService();
      await recovered.initialize();

      expect(recovered.getData().items['movie'].title).toBe('Movie');
      const backups = await recovered.getRecoveryBackups();
      expect(backups).toHaveLength(1);
      await expect(recovered.getRecoveryBackupByKey(backups[0].key)).resolves.toEqual(raw);

      const reloaded = createStorageService();
      await reloaded.initialize();
      expect(reloaded.getData()).toEqual(recovered.getData());
      expect(await reloaded.getRecoveryBackups()).toHaveLength(1);
      database.close();
    },
  );

  it('backs up original persisted data before repairing a missing group without dropping records', async () => {
    const service = createStorageService();
    await service.initialize();
    const database = await openTestDatabase();
    const raw = dataWithMovie();
    raw.items.movie.groupId = 'missing';
    await writeRecord(database, raw);

    const recovered = createStorageService();
    await recovered.initialize();

    expect(recovered.getData().items['movie'].groupId).toBe('ungrouped');
    const backups = await recovered.getRecoveryBackups();
    expect(backups).toHaveLength(1);
    await expect(recovered.getRecoveryBackupByKey(backups[0].key)).resolves.toEqual(raw);
    const reloaded = createStorageService();
    await reloaded.initialize();
    expect(reloaded.getData()).toEqual(recovered.getData());
    expect(await reloaded.getRecoveryBackups()).toHaveLength(1);
    database.close();
  });

  it('backs up malformed own prototype-named records before omitting them during startup', async () => {
    const service = createStorageService();
    await service.initialize();
    const database = await openTestDatabase();
    const valid = dataWithMovie();
    const malformed = { ['__proto__']: { invalid: true } };
    const raw = {
      ...valid,
      items: { ...valid.items, ...malformed },
      groups: malformed,
      deletedItems: malformed,
    };
    await writeRecord(database, raw);

    const recovered = createStorageService();
    await recovered.initialize();

    expect(recovered.getData().items).toEqual(valid.items);
    expect(recovered.getData().groups).toEqual(valid.groups);
    expect(recovered.getData().deletedItems).toEqual({});
    const backups = await recovered.getRecoveryBackups();
    expect(backups).toHaveLength(1);
    await expect(recovered.getRecoveryBackupByKey(backups[0].key)).resolves.toEqual(raw);
    database.close();
  });

  it.each(['title', 'identity', 'date', 'group'])(
    'rejects unsafe normal saves (%s) without publishing or persisting partial recovery',
    async (invalid) => {
      const service = createStorageService();
      await service.initialize();
      const original = service.getData();
      const unsafe = dataWithMovie();
      const movie = unsafe.items.movie;
      const other = { ...movie, id: 'other' };
      if (invalid === 'title') movie.title = '  ';
      if (invalid === 'identity') movie.id = 'different';
      if (invalid === 'date') movie.createdAt = 'invalid';
      if (invalid === 'group') movie.groupId = 'missing';

      await expect(
        service.saveData({ ...unsafe, items: { ...unsafe.items, other } }),
      ).rejects.toThrow(/Invalid/);

      expect(service.getData()).toEqual(original);
      const reloaded = createStorageService();
      await reloaded.initialize();
      expect(reloaded.getData()).toEqual(original);
      expect(await reloaded.getRecoveryBackups()).toEqual([]);
    },
  );

  it.each(['omission', 'reference repair'])(
    'preserves recoverable raw data when its backup fails (%s), even after session edits',
    async (recovery) => {
      const firstService = createStorageService();
      await firstService.initialize();
      const database = await openTestDatabase();
      const valid = dataWithMovie();
      const raw =
        recovery === 'omission'
          ? { ...valid, items: { ...valid.items, bad: { invalid: true } } }
          : { ...valid, items: { movie: { ...valid.items.movie, groupId: 'missing' } } };
      await writeRecord(database, raw);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const put = FakeIDBObjectStore.prototype.put;
      const failure = vi.spyOn(FakeIDBObjectStore.prototype, 'put').mockImplementation(function (
        this: IDBObjectStore,
        value,
        key,
      ) {
        if (typeof key === 'string' && key.startsWith('watch-list-data-backup-')) {
          throw new Error('Backup unavailable');
        }
        return put.call(this, value, key);
      });

      const recovered = createStorageService();
      await recovered.initialize();
      expect(recovered.getData().items['movie'].title).toBe('Movie');
      expect(recovered.getInMemorySessionSignal()()).toBe(true);
      await recovered.saveData(withGroup(recovered.getData(), 'session-only'));
      expect(recovered.getInMemorySessionSignal()()).toBe(true);
      failure.mockRestore();

      const reloaded = createStorageService();
      await reloaded.initialize();
      const backups = await reloaded.getRecoveryBackups();
      expect(backups).toHaveLength(1);
      await expect(reloaded.getRecoveryBackupByKey(backups[0].key)).resolves.toEqual(raw);
      expect(reloaded.getData().groups['session-only']).toBeUndefined();
      database.close();
    },
  );

  it('returns recovery backups sorted newest first', async () => {
    const firstService = createStorageService();
    await firstService.initialize();
    const database = await openTestDatabase();

    const oldTimestamp = 1000000000000;
    const newTimestamp = 1000000001000;
    await writeRecord(database, { old: true }, `watch-list-data-backup-${oldTimestamp}`);
    await writeRecord(database, { new: true }, `watch-list-data-backup-${newTimestamp}`);

    const secondService = createStorageService();
    await secondService.initialize();

    const backups = await secondService.getRecoveryBackups();
    expect(backups).toHaveLength(2);
    expect(backups[0].key).toBe(`watch-list-data-backup-${newTimestamp}`);
    expect(backups[1].key).toBe(`watch-list-data-backup-${oldTimestamp}`);
  });

  it('prunes old backups beyond the limit', async () => {
    const firstService = createStorageService();
    await firstService.initialize();
    const database = await openTestDatabase();

    for (let i = 0; i < 12; i++) {
      await writeRecord(database, { index: i }, `watch-list-data-backup-${1000000000000 + i}`);
    }
    await writeRecord(database, { invalid: true });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const secondService = createStorageService();
    await secondService.initialize();

    const backups = await secondService.getRecoveryBackups();
    expect(backups).toHaveLength(10);
    expect(backups[9].key).toBe('watch-list-data-backup-1000000000003');
  });

  it('throws when getting a backup by invalid key', async () => {
    const firstService = createStorageService();
    await firstService.initialize();

    await expect(firstService.getRecoveryBackupByKey('invalid-key')).rejects.toThrow(
      'Invalid backup key',
    );
  });

  it('throws when getting a backup by key that does not exist', async () => {
    const firstService = createStorageService();
    await firstService.initialize();

    await expect(
      firstService.getRecoveryBackupByKey('watch-list-data-backup-9999999999999'),
    ).rejects.toThrow('Recovery backup not found');
  });

  it('does not overwrite unreadable data when creating its backup fails', async () => {
    const firstService = createStorageService();
    await firstService.initialize();
    const database = await openTestDatabase();
    const corruptData = { invalid: true };
    await writeRecord(database, corruptData);

    const secondService = createStorageService();
    const storage = secondService as unknown as {
      backupRawData: (data: unknown) => Promise<void>;
    };
    vi.spyOn(storage, 'backupRawData').mockRejectedValue(new Error('Backup unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(secondService.initialize()).resolves.toBeUndefined();

    await expect(readRecord(database, 'watch-list-data')).resolves.toEqual(corruptData);
  });

  it('writes normalization defaults back to storage', async () => {
    const service = createStorageService();
    await service.initialize();
    const database = await openTestDatabase();
    await writeRecord(database, {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: {},
      items: {},
    });

    const reloadedService = createStorageService();
    await reloadedService.initialize();

    const persisted = await readRecord<Record<string, unknown>>(database, 'watch-list-data');
    expect(persisted?.['deletedItems']).toEqual({});
    expect(persisted?.['groups']).toMatchObject({
      ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 },
    });
  });

  it('migrates v2 data with totalEpisodes to the current seasons array', async () => {
    const service = createStorageService();
    await service.initialize();

    await service.importData({
      schemaVersion: 2,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: {},
      items: {
        series1: {
          id: 'series1',
          title: 'Test Series',
          type: 'series',
          groupId: 'ungrouped',
          status: 'in-progress',
          isAdult: false,
          createdAt: '2026-03-01T10:00:00.000Z',
          progress: {
            season: 2,
            episode: 3,
            totalEpisodes: 10,
            totalSeasons: 3,
          },
          watchHistory: [
            {
              date: '2026-03-02T12:00:00.000Z',
              season: 2,
              episode: 3,
            },
          ],
        },
      },
    });

    const data = service.getData();
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    const progress = data.items['series1'].progress!;
    expect(progress.seasons).toEqual([{ seasonNumber: 2, totalEpisodes: 10 }]);
    expect('totalEpisodes' in progress).toBe(false);
    expect('totalSeasons' in progress).toBe(false);
    expect(data.items['series1'].watchHistory).toEqual([
      {
        date: '2026-03-02T12:00:00.000Z',
        season: 2,
        episode: 3,
      },
    ]);
  });

  it('clears legacy remote poster URLs during the offline-image migration', async () => {
    const service = createStorageService();
    await service.initialize();

    await service.importData({
      schemaVersion: 5,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
      items: {
        movie1: {
          id: 'movie1',
          title: 'Old Poster',
          type: 'movie',
          groupId: 'ungrouped',
          status: 'not-started',
          isAdult: false,
          createdAt: '2026-03-01T10:00:00.000Z',
          watchHistory: [],
          posterPath: 'https://example.test/poster.jpg',
        },
      },
    });

    const item = service.getData().items['movie1'];
    expect(item.posterId).toBeUndefined();
    expect('posterPath' in item).toBe(false);
  });

  it('rejects invalid imports', async () => {
    const service = createStorageService();
    await service.initialize();

    await expect(
      service.importData({
        schemaVersion: 2,
        lastModifiedAt: '2026-04-01T10:00:00.000Z',
        groups: {},
        items: [],
      }),
    ).rejects.toThrowError('Invalid data format');
  });

  it('quarantines series with duplicate season numbers instead of rejecting the import', async () => {
    const service = createStorageService();
    await service.initialize();

    await service.importData({
      schemaVersion: 4,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: {},
      items: {
        bad: {
          id: 'bad',
          title: 'Bad Series',
          type: 'series',
          groupId: 'ungrouped',
          status: 'in-progress',
          isAdult: false,
          createdAt: '2026-03-01T10:00:00.000Z',
          progress: {
            season: 1,
            episode: 1,
            seasons: [
              { seasonNumber: 1, totalEpisodes: 10 },
              { seasonNumber: 1, totalEpisodes: 8 },
            ],
          },
          watchHistory: [],
        },
        good: {
          id: 'good',
          title: 'Good Series',
          type: 'series',
          groupId: 'ungrouped',
          status: 'in-progress',
          isAdult: false,
          createdAt: '2026-03-01T10:00:00.000Z',
          watchHistory: [],
        },
      },
    });

    const data = service.getData();
    expect(data.items['bad']).toBeUndefined();
    expect(data.items['good']).toMatchObject({ title: 'Good Series' });
  });

  it('rejects an import when every item is invalid', async () => {
    const service = createStorageService();
    await service.initialize();

    await expect(
      service.importData({
        schemaVersion: 4,
        lastModifiedAt: '2026-04-01T10:00:00.000Z',
        groups: {},
        items: {
          series1: {
            id: 'series1',
            title: 'Test Series',
            type: 'series',
            groupId: 'ungrouped',
            status: 'in-progress',
            isAdult: false,
            createdAt: '2026-03-01T10:00:00.000Z',
            progress: {
              season: 1,
              episode: 1,
              seasons: [
                { seasonNumber: 1, totalEpisodes: 10 },
                { seasonNumber: 1, totalEpisodes: 8 },
              ],
            },
            watchHistory: [],
          },
        },
      }),
    ).rejects.toThrowError('Invalid migrated data');
  });

  it('remaps items of dropped groups to the default group', async () => {
    const service = createStorageService();
    await service.initialize();

    await service.importData({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: {
        ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 },
        bad: { id: 'bad' },
      },
      items: {
        item1: {
          id: 'item1',
          title: 'Orphaned',
          type: 'movie',
          groupId: 'bad',
          status: 'not-started',
          isAdult: false,
          createdAt: '2026-03-01T10:00:00.000Z',
          watchHistory: [],
        },
      },
    });

    const data = service.getData();
    expect(data.groups['bad']).toBeUndefined();
    expect(data.items['item1'].groupId).toBe('ungrouped');
  });

  it('accepts v4 series seasons with a first episode air date', async () => {
    const service = createStorageService();
    await service.initialize();

    await service.importData({
      schemaVersion: 4,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: {},
      items: {
        series1: {
          id: 'series1',
          title: 'Weekly Series',
          type: 'series',
          groupId: 'ungrouped',
          status: 'in-progress',
          isAdult: false,
          createdAt: '2026-03-01T10:00:00.000Z',
          progress: {
            season: 1,
            episode: 2,
            seasons: [{ seasonNumber: 1, totalEpisodes: 10, firstEpisodeAirDate: '2026-05-01' }],
          },
          watchHistory: [],
        },
      },
    });

    expect(service.getData().items['series1'].progress?.seasons[0].firstEpisodeAirDate).toBe(
      '2026-05-01',
    );
  });

  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])('settles intents without leaking failed changes (%s, %s)', async (first, second) => {
    const service = createStorageService();
    await service.initialize();
    abortStorageWrites([first, second]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const results = await Promise.allSettled([
      service.mutate((data) => {
        data.groups['first'] = { id: 'first', name: 'First', order: 1 };
        return 'created-first';
      }),
      service.mutate((data) => {
        data.groups['second'] = { id: 'second', name: 'Second', order: 2 };
      }),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      first ? 'fulfilled' : 'rejected',
      second ? 'fulfilled' : 'rejected',
    ]);
    if (first)
      expect(results[0]).toMatchObject({
        value: { value: 'created-first', durability: 'persistent' },
      });
    expect(Object.hasOwn(service.getData().groups, 'first')).toBe(first);
    expect(Object.hasOwn(service.getData().groups, 'second')).toBe(second);
    const reloaded = createStorageService();
    await reloaded.initialize();
    expect(reloaded.getData()).toEqual(service.getData());
  });

  it.each([false, true])(
    'orders legacy saves and intents before initialization (session: %s)',
    async (session) => {
      const service = createStorageService();
      if (session) {
        vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
          throw new Error('Unavailable');
        });
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
      }
      const first = service.saveData(withGroup(createDefaultStorageData(), 'legacy'));
      const second = service.mutate((data) => {
        data.groups['intent'] = { id: 'intent', name: 'Intent', order: 2 };
      });
      await first;
      expect(await second).toEqual({
        value: undefined,
        durability: session ? 'session-only' : 'persistent',
      });
      expect(Object.keys(service.getData().groups).sort()).toEqual([
        'intent',
        'legacy',
        'ungrouped',
      ]);
      expect(service.getInMemorySessionSignal()()).toBe(session);
    },
  );

  it('publishes a committed intent when a later poster import is rejected in session-only mode', async () => {
    const service = createStorageService();
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('Unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await service.initialize();
    const mutation = service.mutate((data) => {
      data.groups['session'] = { id: 'session', name: 'Session', order: 1 };
    });
    const rejected = service.importDataWithImages(createDefaultStorageData(), [poster('poster')]);
    await expect(rejected).rejects.toThrow(/Cannot import posters/);
    await mutation;
    expect(service.getData().groups['session']).toBeDefined();
  });

  describe.each(['save', 'import', 'portable'] as const)(
    'coexisting legacy %s and intent writes',
    (kind) => {
      describe.each([false, true])('intent invoked first: %s', (intentFirst) => {
        it.each([
          [false, false],
          [false, true],
          [true, false],
          [true, true],
        ])(
          'settles success/failure combinations without provisional leakage (%s, %s)',
          async (firstSucceeds, secondSucceeds) => {
            const service = createStorageService();
            await service.initialize();
            const initial = service.getData();
            abortStorageWrites([firstSucceeds, secondSucceeds]);
            vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const legacy = () => {
              const snapshot = withGroup(initial, 'legacy');
              switch (kind) {
                case 'save':
                  return service.saveData(snapshot);
                case 'import':
                  return service.importData(snapshot);
                case 'portable':
                  return service.importDataWithImages(snapshot, []);
              }
            };
            const intent = () =>
              service.mutate((data) => {
                data.groups['intent'] = { id: 'intent', name: 'Intent', order: 2 };
              });
            const first = intentFirst ? intent() : legacy();
            const second = intentFirst ? legacy() : intent();
            const results = await Promise.allSettled([first, second]);
            expect(results.map((result) => result.status)).toEqual([
              firstSucceeds ? 'fulfilled' : 'rejected',
              secondSucceeds ? 'fulfilled' : 'rejected',
            ]);
            expect(Object.hasOwn(service.getData().groups, 'legacy')).toBe(
              intentFirst ? secondSucceeds : firstSucceeds,
            );
            expect(Object.hasOwn(service.getData().groups, 'intent')).toBe(
              intentFirst ? firstSucceeds && !secondSucceeds : secondSucceeds,
            );
            const reloaded = createStorageService();
            await reloaded.initialize();
            expect(reloaded.getData()).toEqual(service.getData());
          },
        );
      });
    },
  );

  it.each(['throw', 'invalid'] as const)(
    'discards a draft that fails by %s and continues the queue',
    async (failure) => {
      const service = createStorageService();
      await service.initialize();
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const failed = service.mutate((data) => {
        data.groups['leaked'] = { id: 'leaked', name: 'Leaked', order: 1 };
        if (failure === 'throw') throw new Error('Intent failed');
        data.groups['ungrouped'].id = 'invalid-identity';
      });
      const successful = service.mutate((data) => {
        data.groups['kept'] = { id: 'kept', name: 'Kept', order: 1 };
      });
      expect(
        (await Promise.allSettled([failed, successful])).map((result) => result.status),
      ).toEqual(['rejected', 'fulfilled']);
      expect(Object.keys(service.getData().groups)).toEqual(['ungrouped', 'kept']);
      expect(service.getSaveErrorSignal()()).toBeNull();
      const reloaded = createStorageService();
      await reloaded.initialize();
      expect(reloaded.getData()).toEqual(service.getData());
    },
  );

  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    'keeps publication ordered across startup when saves settle (%s, %s)',
    async (firstSucceeds, secondSucceeds) => {
      const service = createStorageService();
      // The first queued save must wait for startup; the next can publish immediately.
      const first = service.saveData(withGroup(createDefaultStorageData(), 'first'));
      await service.initialize();
      abortStorageWrites([firstSucceeds, secondSucceeds]);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const second = service.saveData(withGroup(createDefaultStorageData(), 'second'));
      const results = await Promise.allSettled([first, second]);
      expect(results.map((result) => result.status)).toEqual([
        firstSucceeds ? 'fulfilled' : 'rejected',
        secondSucceeds ? 'fulfilled' : 'rejected',
      ]);
      expect(Object.keys(service.getData().groups).sort()).toEqual(
        secondSucceeds
          ? ['second', 'ungrouped']
          : firstSucceeds
            ? ['first', 'ungrouped']
            : ['ungrouped'],
      );
      const reloaded = createStorageService();
      await reloaded.initialize();
      expect(reloaded.getData()).toEqual(service.getData());
    },
  );

  it('restores the last persisted data when an import cannot be written', async () => {
    const service = createStorageService();
    await service.initialize();
    const persistedData = service.getData();
    const storage = service as unknown as {
      writeData: (data: unknown) => Promise<void>;
    };
    vi.spyOn(storage, 'writeData').mockRejectedValueOnce(new Error('Disk full'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      service.importData({
        ...persistedData,
        groups: {
          ...persistedData.groups,
          test: { id: 'test', name: 'Test', order: 1 },
        },
      }),
    ).rejects.toThrowError('Disk full');

    expect(service.getData()).toEqual(persistedData);
    expect(error).toHaveBeenCalledWith('Failed to save watch-list data:', expect.any(Error));
  });

  it('restores an unmodified nested snapshot when a mutated update cannot be written', async () => {
    const service = createStorageService();
    await service.initialize();
    const storage = service as unknown as {
      writeData: (data: unknown) => Promise<void>;
    };
    vi.spyOn(storage, 'writeData').mockRejectedValueOnce(new Error('Disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const changed = service.getData();
    changed.groups['ungrouped'].name = 'Renamed';

    await expect(service.importData(changed)).rejects.toThrowError('Disk full');

    expect(service.getData().groups['ungrouped'].name).toBe('Ungrouped');
  });

  it('keeps a newer queued update when an earlier write fails', async () => {
    const service = createStorageService();
    await service.initialize();
    const persistedData = service.getData();
    const storage = service as unknown as {
      writeData: (data: unknown) => Promise<void>;
    };
    vi.spyOn(storage, 'writeData').mockRejectedValueOnce(new Error('Disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const failedImport = service.importData(withGroup(persistedData, 'failed'));
    const succeedingImport = service.importData(withGroup(persistedData, 'succeeding'));

    await expect(failedImport).rejects.toThrowError('Disk full');
    await succeedingImport;

    expect(service.getData().groups['succeeding']).toMatchObject({ name: 'succeeding' });
  });

  describe.each([
    ['save', 'save'],
    ['save', 'import'],
    ['import', 'save'],
    ['import', 'import'],
  ] as const)('overlapping %s then %s', (firstKind, secondKind) => {
    it.each([
      { firstSucceeds: false, secondSucceeds: false },
      { firstSucceeds: false, secondSucceeds: true },
      { firstSucceeds: true, secondSucceeds: false },
      { firstSucceeds: true, secondSucceeds: true },
    ])(
      'keeps committed data and posters when writes succeed: $firstSucceeds, $secondSucceeds',
      async ({ firstSucceeds, secondSucceeds }) => {
        const service = createStorageService();
        await service.initialize();
        await service.importDataWithImages(withGroup(service.getData(), 'committed'), [
          poster('committed'),
        ]);
        const committed = service.getData();
        abortStorageWrites([firstSucceeds, secondSucceeds]);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:poster');

        const firstWrite = write(firstKind, 'first');
        expect(service.getData().groups).toEqual(withGroup(committed, 'first').groups);
        const secondWrite = write(secondKind, 'second');
        const secondSnapshot = service.getData();
        expect(secondSnapshot.groups).toEqual(withGroup(committed, 'second').groups);
        const settled = Promise.allSettled([firstWrite, secondWrite]);

        await Promise.allSettled([firstWrite]);
        expect(service.getData()).toEqual(secondSnapshot);
        const results = await settled;
        expect(results.map((result) => result.status)).toEqual([
          firstSucceeds ? 'fulfilled' : 'rejected',
          secondSucceeds ? 'fulfilled' : 'rejected',
        ]);

        const expectedGroups = secondSucceeds
          ? withGroup(committed, 'second').groups
          : firstSucceeds
            ? withGroup(committed, 'first').groups
            : committed.groups;
        expect(service.getData().groups).toEqual(expectedGroups);
        if (secondSucceeds) {
          expect(service.getSaveErrorSignal()()).toBeNull();
        } else {
          expect(service.getSaveErrorSignal()()).toEqual(expect.any(String));
        }
        const reloaded = createStorageService();
        await reloaded.initialize();
        expect(reloaded.getData()).toEqual(service.getData());

        const expectedPoster =
          secondSucceeds && secondKind === 'import'
            ? 'second'
            : firstSucceeds && firstKind === 'import'
              ? 'first'
              : 'committed';
        const images = TestBed.inject(ImageStorageService);
        for (const id of ['committed', 'first', 'second']) {
          expect(await images.getUrl(id)).toBe(id === expectedPoster ? 'blob:poster' : null);
        }

        function write(kind: typeof firstKind, id: string) {
          const data = withGroup(committed, id);
          return kind === 'save'
            ? service.saveData(data)
            : service.importDataWithImages(data, [poster(id)]);
        }
      },
    );
  });

  it('restores a newly committed save after two later portable imports abort and accepts further saves', async () => {
    const service = createStorageService();
    await service.initialize();
    const initial = service.getData();
    abortStorageWrites([true, false, false]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const results = await Promise.allSettled([
      service.saveData(withGroup(initial, 'committed')),
      service.importDataWithImages(withGroup(initial, 'failed-first'), []),
      service.importDataWithImages(withGroup(initial, 'failed-second'), []),
    ]);

    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'rejected']);
    expect(service.getData().groups).toEqual(withGroup(initial, 'committed').groups);
    const reloaded = createStorageService();
    await reloaded.initialize();
    expect(reloaded.getData()).toEqual(service.getData());

    await service.saveData(withGroup(service.getData(), 'recovered'));
    expect(service.getSaveErrorSignal()()).toBeNull();
    expect(service.getData().groups).toEqual(
      withGroup(withGroup(initial, 'committed'), 'recovered').groups,
    );
    const recovered = createStorageService();
    await recovered.initialize();
    expect(recovered.getData()).toEqual(service.getData());
  });

  it('rejects when a read transaction is aborted', async () => {
    const service = createStorageService();
    await service.initialize();
    const getAllKeys = FakeIDBObjectStore.prototype.getAllKeys;
    vi.spyOn(FakeIDBObjectStore.prototype, 'getAllKeys').mockImplementation(function (
      this: IDBObjectStore,
    ) {
      const request = getAllKeys.call(this);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });

    await expect(service.getRecoveryBackups()).rejects.toThrow();
  });

  it('keeps edits in memory and the non-persistent indicator active when IndexedDB is unavailable', async () => {
    const service = createStorageService();
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('Unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await service.initialize();
    expect(service.getInMemorySessionSignal()()).toBe(true);

    const updated = {
      ...service.getData(),
      groups: {
        ...service.getData().groups,
        test: { id: 'test', name: 'Test', order: 1 },
      },
    };
    await expect(service.saveData(updated)).resolves.toBeUndefined();

    expect(service.getData().groups['test']).toMatchObject({ name: 'Test' });
    expect(service.getSaveErrorSignal()()).toBeNull();
    expect(service.getInMemorySessionSignal()()).toBe(true);
  });

  it('imports data without images in memory without clearing the non-persistent indicator', async () => {
    const service = createStorageService();
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('Unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await service.initialize();

    const result = await service.importDataWithImages(
      {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        lastModifiedAt: '2026-04-01T10:00:00.000Z',
        groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
        items: {},
        deletedItems: {},
      },
      [],
    );

    expect(result.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.dropped).toEqual({ groups: 0, items: 0, deletedItems: 0 });
    expect(service.getSaveErrorSignal()()).toBeNull();
    expect(service.getInMemorySessionSignal()()).toBe(true);
  });

  it('rejects poster imports without changing session data when IndexedDB is unavailable', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('Unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = createStorageService();
    await service.initialize();
    await service.saveData(withGroup(service.getData(), 'session'));
    const previous = service.getData();
    const imported = dataWithMovie();

    await expect(
      service.importDataWithImages(
        {
          ...imported,
          items: { movie: { ...imported.items.movie, posterId: 'image-1' } },
        },
        [{ id: 'image-1', blob: new Blob(['poster'], { type: 'image/png' }) }],
      ),
    ).rejects.toThrow('Cannot import posters while persistent storage is unavailable');

    expect(service.getData()).toEqual(previous);
  });

  it('returns no recovery backups when IndexedDB is unavailable', async () => {
    const service = createStorageService();
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('Unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await service.initialize();

    await expect(service.getRecoveryBackups()).resolves.toEqual([]);
    await expect(service.getRecoveryBackupByKey('watch-list-data-backup-123')).rejects.toThrow(
      'Recovery backup not found',
    );
  });
});

function createStorageService() {
  return TestBed.runInInjectionContext(() => new StorageService());
}

function upgradeAfterNextRead(database: IDBDatabase, raw: unknown) {
  return new Promise<void>((resolve, reject) => {
    const get = FakeIDBObjectStore.prototype.get;
    const spy = vi.spyOn(FakeIDBObjectStore.prototype, 'get').mockImplementation(function (
      this: IDBObjectStore,
      key,
    ) {
      const request = get.call(this, key);
      if (this.name === 'storage' && key === 'watch-list-data') {
        request.addEventListener('success', () => {
          spy.mockRestore();
          // Queue another tab's write before the reader can queue a replacement.
          void writeRecord(database, raw).then(resolve, reject);
        });
      }
      return request;
    });
  });
}

function abortStorageWrites(successes: boolean[]) {
  const put = FakeIDBObjectStore.prototype.put;
  vi.spyOn(FakeIDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    value,
    key,
  ) {
    const request = put.call(this, value, key);
    if (this.name === 'storage' && key === 'watch-list-data' && successes.shift() === false) {
      queueMicrotask(() => this.transaction.abort());
    }
    return request;
  });
}

function poster(id: string) {
  return { id, blob: new Blob([id], { type: 'image/png' }) };
}

function withGroup(data: ReturnType<StorageService['getData']>, id: string) {
  return {
    ...data,
    groups: {
      ...data.groups,
      [id]: { id, name: id, order: 1 },
    },
  };
}

function dataWithMovie() {
  const movie: Item = {
    id: 'movie',
    title: 'Movie',
    type: 'movie',
    groupId: 'ungrouped',
    status: 'not-started',
    isAdult: false,
    createdAt: '2026-01-01',
    watchHistory: [],
  };
  return { ...createDefaultStorageData(), items: { movie } };
}

function openTestDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('watch-list');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function writeRecord(database: IDBDatabase, data: unknown, key = 'watch-list-data'): Promise<void> {
  const transaction = database.transaction('storage', 'readwrite');
  transaction.objectStore('storage').put(data, key);

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function readRecord<T>(database: IDBDatabase, key: string): Promise<T | undefined> {
  const transaction = database.transaction('storage', 'readonly');
  const request = transaction.objectStore('storage').get(key) as IDBRequest<T | undefined>;

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
