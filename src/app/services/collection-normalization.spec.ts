import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { createDefaultStorageData } from '../domain/storage-schema';
import { groupHistoryEntries } from '../utils/watch-history.utils';
import { ImportExportService } from './import-export.service';
import { RoundRobinService } from './round-robin.service';
import { StatsService } from './stats.service';
import { StorageService } from './storage.service';
import { WatchListService } from './watch-list.service';

function legacyRecoveryFixture() {
  const movie = {
    id: 'movie',
    title: 'Movie',
    type: 'movie',
    status: 'completed',
    groupId: 'missing',
    createdAt: '2026-01-01',
    watchHistory: [{ date: '2026-01-02' }],
  };
  return {
    ...createDefaultStorageData(),
    schemaVersion: 2,
    lastModifiedAt: 'legacy timestamp',
    groups: { broken: { id: 'other', name: 'Broken identity', order: 1 } },
    items: {
      movie,
      series: {
        ...movie,
        id: 'series',
        title: 'Series',
        type: 'series',
        status: 'in-progress',
        groupId: 'ungrouped',
        progress: { season: 1, episode: 2, totalEpisodes: 12 },
        watchHistory: [{ date: '2026-01-04T12:00:00Z', season: 1, episode: 1 }],
      },
      alias: movie,
      badDate: { ...movie, id: 'badDate', watchHistory: [{ date: 'invalid' }] },
    },
    deletedItems: {
      archived: {
        itemId: 'archived',
        itemTitle: 'Archived',
        itemType: 'movie',
        deletedAt: '2026-01-07',
        watchHistory: [{ date: '2026-01-06T12:00:00Z' }],
      },
      bad: {
        itemId: 'bad',
        itemTitle: 'Bad history',
        itemType: 'series',
        deletedAt: '2026-01-07',
        watchHistory: [{ date: '2026-01-01', episode: -1 }],
      },
    },
  };
}

function jsonFile(payload: unknown) {
  const file = new File([], 'collection.json');
  Object.defineProperty(file, 'text', { value: async () => JSON.stringify(payload) });
  return file;
}

describe('normalized collections at domain consumer boundaries', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  });

  it.each(['startup', 'raw import', 'portable import'])(
    'salvages a mixed legacy collection for history, recommendations, and statistics via %s',
    async (path) => {
      const raw = legacyRecoveryFixture();
      const storage = TestBed.inject(StorageService);
      if (path === 'startup') {
        const seed = TestBed.runInInjectionContext(() => new StorageService());
        await seed.initialize();
        const database = await new Promise<IDBDatabase>((resolve) => {
          const request = indexedDB.open('watch-list');
          request.onsuccess = () => resolve(request.result);
        });
        const transaction = database.transaction('storage', 'readwrite');
        transaction.objectStore('storage').put(raw, 'watch-list-data');
        await new Promise<void>((resolve) => (transaction.oncomplete = () => resolve()));
        database.close();
        await storage.initialize();
        const backups = await storage.getRecoveryBackups();
        expect(backups).toHaveLength(1);
        await expect(storage.getRecoveryBackupByKey(backups[0].key)).resolves.toEqual(raw);
      } else {
        await storage.initialize();
        const payload = path === 'raw import' ? raw : { data: raw, images: [] };
        await expect(
          TestBed.inject(ImportExportService).importData(jsonFile(payload)),
        ).resolves.toEqual({
          durability: 'persistent',
          dropped: { groups: 1, items: 2, deletedItems: 1 },
          repairedGroupReferences: 1,
        });
      }

      expect(Object.keys(storage.getData().items)).toEqual(['movie', 'series']);
      expect(storage.getData().items['movie'].groupId).toBe('ungrouped');
      expect(storage.getData().items['series'].progress).toEqual({
        season: 1,
        episode: 2,
        seasons: [{ seasonNumber: 1, totalEpisodes: 12 }],
      });
      const history = TestBed.inject(WatchListService).getAllWatchHistory();
      expect(history).toHaveLength(3);
      const groups = groupHistoryEntries(history);
      expect(groups).toHaveLength(3);
      expect(groups.flatMap((group) => group.entries)).toHaveLength(3);
      expect(JSON.stringify(groups)).not.toMatch(/Invalid Date|NaN/);
      expect(TestBed.inject(RoundRobinService).nextSeries()?.id).toBe('series');
      expect(TestBed.inject(RoundRobinService).nextMovie()).toBeNull();
      const stats = TestBed.inject(StatsService);
      expect(stats.totalItems()).toBe(2);
      expect(stats.completedCount()).toBe(1);
      expect(stats.totalEpisodesWatched()).toBe(1);
      expect(stats.avgEpisodesPerActiveSeries()).toBe('1.0');
      expect(stats.avgTimeToComplete()).toBe('1 day');
      expect(stats.totalDaysWatched()).toBe(3);
      expect(stats.longestStreak()).toBe(1);
      expect(Number.isFinite(stats.currentStreak())).toBe(true);
      expect(Number.isFinite(stats.mostActiveDayCount())).toBe(true);
      expect(Number.isFinite(stats.mostActiveTimeOfDayCount())).toBe(true);
    },
  );

  it.each(['blank title', 'identity mismatch', 'invalid creation date', 'prototype-named record'])(
    'rejects imports whose supplied items are all unsafe (%s), preserving the current collection',
    async (unsafe) => {
      const storage = TestBed.inject(StorageService);
      await storage.initialize();
      const original = storage.getData();
      const movie = legacyRecoveryFixture().items.movie;
      const invalid = {
        ...movie,
        isAdult: false,
        ...(unsafe === 'blank title' ? { title: ' ' } : {}),
        ...(unsafe === 'identity mismatch' ? { id: 'alias' } : {}),
        ...(unsafe === 'invalid creation date' ? { createdAt: '2026-02-30' } : {}),
      };
      await expect(
        TestBed.inject(ImportExportService).importData(
          jsonFile({
            ...createDefaultStorageData(),
            items:
              unsafe === 'prototype-named record'
                ? { ['__proto__']: { invalid: true } }
                : { movie: invalid },
          }),
        ),
      ).rejects.toThrow('Invalid migrated data');
      expect(storage.getData()).toEqual(original);
      const reloaded = TestBed.runInInjectionContext(() => new StorageService());
      await reloaded.initialize();
      expect(reloaded.getData()).toEqual(original);
    },
  );
});
