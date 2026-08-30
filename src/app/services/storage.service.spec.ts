import { CURRENT_SCHEMA_VERSION } from '../models/storage.model';
import { StorageService } from './storage.service';
import { IDBFactory } from 'fake-indexeddb';
import { vi, afterEach } from 'vitest';

describe('StorageService', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: new IDBFactory(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a default dataset when storage is empty', async () => {
    const service = new StorageService();
    await service.initialize();
    const data = service.getData();

    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.groups['ungrouped'].name).toBe('Ungrouped');
    expect(data.deletedItems).toEqual({});
  });

  it('allows initialization to be retried after an open failure', async () => {
    const service = new StorageService();
    const storage = service as unknown as {
      openDatabase: () => Promise<IDBDatabase>;
    };
    vi.spyOn(storage, 'openDatabase').mockRejectedValueOnce(new Error('Unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(service.getData().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('closes an opened database when initialization fails', async () => {
    const service = new StorageService();
    const database = { close: vi.fn() } as unknown as IDBDatabase;
    const storage = service as unknown as {
      openDatabase: () => Promise<IDBDatabase>;
      readData: () => Promise<unknown | undefined>;
      writeData: (data: unknown) => Promise<void>;
    };
    vi.spyOn(storage, 'openDatabase').mockResolvedValue(database);
    vi.spyOn(storage, 'readData').mockResolvedValue(undefined);
    vi.spyOn(storage, 'writeData').mockRejectedValue(new Error('Disk full'));

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(database.close).toHaveBeenCalledOnce();
  });

  it('rejects a blocked open request without reading its unavailable result', async () => {
    const service = new StorageService();
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
    vi.spyOn(indexedDB, 'open').mockReturnValue(request);

    const opening = (
      service as unknown as { openDatabase: () => Promise<IDBDatabase> }
    ).openDatabase();
    request.onblocked!({} as IDBVersionChangeEvent);

    await expect(opening).rejects.toThrowError('IndexedDB open request is blocked');
    resultAvailable = true;
    request.onsuccess!(new Event('success'));

    expect(database.close).toHaveBeenCalledOnce();
  });

  it('loads data persisted by an earlier service instance', async () => {
    const firstService = new StorageService();
    await firstService.initialize();
    await firstService.importData({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
      items: {},
      deletedItems: {},
    });

    const secondService = new StorageService();
    await secondService.initialize();

    expect(secondService.getData().lastModifiedAt).not.toBe('2026-04-01T10:00:00.000Z');
    expect(secondService.getData().groups).toEqual(firstService.getData().groups);
  });

  it('replaces malformed persisted data with the default dataset', async () => {
    const firstService = new StorageService();
    await firstService.initialize();
    const database = (firstService as unknown as { database: IDBDatabase }).database;
    const corruptData = { invalid: true };
    await writeRecord(database, corruptData);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const secondService = new StorageService();
    await secondService.initialize();

    expect(secondService.getData()).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
      items: {},
      deletedItems: {},
    });
    expect(error).toHaveBeenCalledWith('Failed to load stored watch-list data:', expect.any(Error));
  });

  it('backs up unreadable data to a timestamped key', async () => {
    const firstService = new StorageService();
    await firstService.initialize();
    const database = (firstService as unknown as { database: IDBDatabase }).database;
    const corruptData = { invalid: true };
    await writeRecord(database, corruptData);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const secondService = new StorageService();
    await secondService.initialize();

    const backups = await secondService.getRecoveryBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0].timestamp).toBeInstanceOf(Date);
    const backup = await readRecord(database, backups[0].key);
    expect(backup).toEqual(corruptData);
  });

  it('returns recovery backups sorted newest first', async () => {
    const firstService = new StorageService();
    await firstService.initialize();
    const database = (firstService as unknown as { database: IDBDatabase }).database;

    const oldTimestamp = 1000000000000;
    const newTimestamp = 1000000001000;
    await writeRecord(database, { old: true }, `watch-list-data-backup-${oldTimestamp}`);
    await writeRecord(database, { new: true }, `watch-list-data-backup-${newTimestamp}`);

    const secondService = new StorageService();
    await secondService.initialize();

    const backups = await secondService.getRecoveryBackups();
    expect(backups).toHaveLength(2);
    expect(backups[0].key).toBe(`watch-list-data-backup-${newTimestamp}`);
    expect(backups[1].key).toBe(`watch-list-data-backup-${oldTimestamp}`);
  });

  it('prunes old backups beyond the limit', async () => {
    const firstService = new StorageService();
    await firstService.initialize();
    const database = (firstService as unknown as { database: IDBDatabase }).database;

    for (let i = 0; i < 12; i++) {
      await writeRecord(database, { index: i }, `watch-list-data-backup-${1000000000000 + i}`);
    }
    await writeRecord(database, { invalid: true });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const secondService = new StorageService();
    await secondService.initialize();

    const backups = await secondService.getRecoveryBackups();
    expect(backups).toHaveLength(10);
    expect(backups[9].key).toBe('watch-list-data-backup-1000000000003');
  });

  it('throws when getting a backup by invalid key', async () => {
    const firstService = new StorageService();
    await firstService.initialize();

    await expect(firstService.getRecoveryBackupByKey('invalid-key')).rejects.toThrow(
      'Invalid backup key',
    );
  });

  it('throws when getting a backup by key that does not exist', async () => {
    const firstService = new StorageService();
    await firstService.initialize();

    await expect(
      firstService.getRecoveryBackupByKey('watch-list-data-backup-9999999999999'),
    ).rejects.toThrow('Recovery backup not found');
  });

  it('does not overwrite unreadable data when creating its backup fails', async () => {
    const firstService = new StorageService();
    await firstService.initialize();
    const database = (firstService as unknown as { database: IDBDatabase }).database;
    const corruptData = { invalid: true };
    await writeRecord(database, corruptData);

    const secondService = new StorageService();
    const storage = secondService as unknown as {
      backupRawData: (data: unknown) => Promise<void>;
    };
    vi.spyOn(storage, 'backupRawData').mockRejectedValue(new Error('Backup unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(secondService.initialize()).resolves.toBeUndefined();

    await expect(readRecord(database, 'watch-list-data')).resolves.toEqual(corruptData);
  });

  it('writes normalization defaults back to storage', async () => {
    const service = new StorageService();
    await service.initialize();
    const database = (service as unknown as { database: IDBDatabase }).database;
    await writeRecord(database, {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: {},
      items: {},
    });

    const reloadedService = new StorageService();
    await reloadedService.initialize();

    const persisted = await readRecord<Record<string, unknown>>(database, 'watch-list-data');
    expect(persisted?.['deletedItems']).toEqual({});
    expect(persisted?.['groups']).toMatchObject({
      ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 },
    });
  });

  it('migrates v2 data with totalEpisodes to the current seasons array', async () => {
    const service = new StorageService();
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
    const service = new StorageService();
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
    const service = new StorageService();
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

  it('rejects series with duplicate season numbers', async () => {
    const service = new StorageService();
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

  it('accepts v4 series seasons with a first episode air date', async () => {
    const service = new StorageService();
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

  it('restores the last persisted data when an import cannot be written', async () => {
    const service = new StorageService();
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
    const service = new StorageService();
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
    const service = new StorageService();
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

  it('rejects when a read transaction is aborted', async () => {
    const service = new StorageService();
    await service.initialize();

    const database = (service as unknown as { database: IDBDatabase }).database;
    const fakeTransaction = {
      objectStore: () => ({ getAllKeys: () => ({}) }),
      oncomplete: null,
      onerror: null,
      onabort: null,
    } as unknown as IDBTransaction;

    const spy = vi.spyOn(database, 'transaction').mockReturnValue(fakeTransaction);

    const promise = service.getRecoveryBackups();
    fakeTransaction.onabort!({} as Event);

    await expect(promise).rejects.toThrowError('Failed to list backup keys');

    spy.mockRestore();
  });
});

function withGroup(data: ReturnType<StorageService['getData']>, id: string) {
  return {
    ...data,
    groups: {
      ...data.groups,
      [id]: { id, name: id, order: 1 },
    },
  };
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
