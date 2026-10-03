import { TestBed } from '@angular/core/testing';
import { WatchListService } from './watch-list.service';
import { StorageService } from './storage.service';
import { Item, SeriesProgress } from '../models/item.model';
import { CURRENT_SCHEMA_VERSION, DeletedItemHistory } from '../models/storage.model';
import { IDBFactory } from 'fake-indexeddb';
import { vi } from 'vitest';
import { RoundRobinService } from './round-robin.service';
import { getCurrentEpisodeAirDate } from '../domain/episode-release';

describe('WatchListService', () => {
  let storageService: StorageService;
  let service: WatchListService;

  beforeEach(async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: new IDBFactory(),
    });
    TestBed.configureTestingModule({});
    storageService = TestBed.inject(StorageService);
    await storageService.initialize();
    service = TestBed.inject(WatchListService);
  });

  describe('addItem', () => {
    it('adds a new item with generated id, createdAt and empty watch history', () => {
      service.addItem({
        title: 'Brand New',
        type: 'series',
        groupId: 'ungrouped',
        status: 'not-started',
        isAdult: false,
      });

      const data = storageService.getData();
      const added = Object.values(data.items).find((item) => item.title === 'Brand New');
      expect(added).toBeDefined();
      expect(added!.id).toMatch(/^item-/);
      expect(added!.watchHistory).toEqual([]);
      expect(new Date(added!.createdAt).getTime()).toBeGreaterThan(0);
    });
  });

  describe('updateItem', () => {
    it('updates an existing item', () => {
      const item = createItem({ id: 'i1', title: 'Before' });
      saveData({ items: { i1: item } });

      service.updateItem({ ...item, title: 'After' });

      expect(storageService.getData().items['i1'].title).toBe('After');
    });
  });

  describe('deleteItem', () => {
    it('moves the item to deletedItems with its watch history', () => {
      const item = createItem({
        id: 'i1',
        title: 'Gone',
        type: 'series',
        watchHistory: [{ date: '2026-01-01T10:00:00.000Z', season: 1, episode: 2 }],
      });
      saveData({ items: { i1: item } });

      service.deleteItem('i1');

      const data = storageService.getData();
      expect(data.items['i1']).toBeUndefined();
      expect(data.deletedItems?.['i1']).toMatchObject({
        itemId: 'i1',
        itemTitle: 'Gone',
        itemType: 'series',
        watchHistory: [{ date: '2026-01-01T10:00:00.000Z', season: 1, episode: 2 }],
      });
      expect(data.deletedItems?.['i1'].deletedAt).toBeDefined();
    });

    it('does nothing when the item does not exist', () => {
      saveData({ items: {} });
      const saveSpy = vi.spyOn(storageService, 'saveData');

      service.deleteItem('missing');

      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('markWatched', () => {
    it('marks a movie as completed with a watch history entry', () => {
      const item = createItem({
        id: 'm1',
        title: 'Movie',
        type: 'movie',
        status: 'in-progress',
        isAdult: false,
      });
      saveData({ items: { m1: item } });

      service.markWatched('m1');

      const updated = storageService.getData().items['m1'];
      expect(updated.status).toBe('completed');
      expect(updated.watchHistory).toHaveLength(1);
      expect(updated.watchHistory[0].date).toBeDefined();
    });

    it('starts a series without progress at season 1 episode 2', () => {
      const item = createItem({
        id: 's1',
        title: 'Fresh Series',
        status: 'in-progress',
        isAdult: false,
      });
      saveData({ items: { s1: item } });

      service.markWatched('s1');

      const updated = storageService.getData().items['s1'];
      expect(updated.progress!.season).toBe(1);
      expect(updated.progress!.episode).toBe(2);
      expect(updated.watchHistory[0]).toMatchObject({ season: 1, episode: 1 });
    });

    it('marks series as completed when watching last episode of final season', () => {
      const item: Item = {
        id: 'series-1',
        title: 'Test Series',
        type: 'series',
        groupId: 'ungrouped',
        status: 'in-progress',
        isAdult: false,
        progress: {
          season: 1,
          episode: 10,
          seasons: [{ seasonNumber: 1, totalEpisodes: 10 }],
        } as SeriesProgress,
        watchHistory: [],
        createdAt: '2026-04-01T10:00:00.000Z',
      };

      storageService.saveData({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        lastModifiedAt: '2026-04-01T10:00:00.000Z',
        groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
        items: { 'series-1': item },
        deletedItems: {},
      });

      service.markWatched('series-1');

      const updatedItem = storageService.getData().items['series-1'];
      expect(updatedItem.status).toBe('completed');
      expect(updatedItem.progress!.episode).toBe(10);
    });

    it('moves to next season episode 1 when watching last episode of current season', () => {
      const item: Item = {
        id: 'series-2',
        title: 'Multi Season Series',
        type: 'series',
        groupId: 'ungrouped',
        status: 'in-progress',
        isAdult: false,
        progress: {
          season: 1,
          episode: 10,
          seasons: [
            { seasonNumber: 1, totalEpisodes: 10 },
            { seasonNumber: 2, totalEpisodes: 8 },
          ],
        } as SeriesProgress,
        watchHistory: [],
        createdAt: '2026-04-01T10:00:00.000Z',
      };

      storageService.saveData({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        lastModifiedAt: '2026-04-01T10:00:00.000Z',
        groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
        items: { 'series-2': item },
        deletedItems: {},
      });

      service.markWatched('series-2');

      const updatedItem = storageService.getData().items['series-2'];
      expect(updatedItem.status).toBe('in-progress');
      expect(updatedItem.progress!.season).toBe(2);
      expect(updatedItem.progress!.episode).toBe(1);
    });

    it('handles non-contiguous season numbers when advancing to next season', () => {
      const item: Item = {
        id: 'series-3',
        title: 'Non-Contiguous Seasons',
        type: 'series',
        groupId: 'ungrouped',
        status: 'in-progress',
        isAdult: false,
        progress: {
          season: 1,
          episode: 5,
          seasons: [
            { seasonNumber: 1, totalEpisodes: 5 },
            { seasonNumber: 3, totalEpisodes: 8 },
          ],
        } as SeriesProgress,
        watchHistory: [],
        createdAt: '2026-04-01T10:00:00.000Z',
      };

      storageService.saveData({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        lastModifiedAt: '2026-04-01T10:00:00.000Z',
        groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
        items: { 'series-3': item },
        deletedItems: {},
      });

      service.markWatched('series-3');

      const updatedItem = storageService.getData().items['series-3'];
      expect(updatedItem.status).toBe('in-progress');
      expect(updatedItem.progress!.season).toBe(3);
      expect(updatedItem.progress!.episode).toBe(1);
    });
  });

  describe('status transitions', () => {
    it('marks an item as completed', () => {
      saveData({ items: { i1: createItem({ id: 'i1', status: 'in-progress', isAdult: false }) } });

      service.markCompleted('i1');

      expect(storageService.getData().items['i1'].status).toBe('completed');
    });

    it('marks an item as dropped', () => {
      saveData({ items: { i1: createItem({ id: 'i1', status: 'in-progress', isAdult: false }) } });

      service.markDropped('i1');

      expect(storageService.getData().items['i1'].status).toBe('dropped');
    });

    it('marks an item as started', () => {
      saveData({ items: { i1: createItem({ id: 'i1', status: 'not-started', isAdult: false }) } });

      service.markStarted('i1');

      expect(storageService.getData().items['i1'].status).toBe('in-progress');
    });

    it('marks a series as paused', () => {
      saveData({
        items: {
          i1: createItem({ id: 'i1', type: 'series', status: 'in-progress', isAdult: false }),
        },
      });

      service.markPaused('i1');

      expect(storageService.getData().items['i1'].status).toBe('paused');
    });

    it('marks a movie as paused', () => {
      saveData({
        items: {
          i1: createItem({ id: 'i1', type: 'movie', status: 'in-progress', isAdult: false }),
        },
      });

      service.markPaused('i1');

      expect(storageService.getData().items['i1'].status).toBe('paused');
    });

    it('does nothing when the item does not exist', () => {
      saveData({
        items: { i1: createItem({ id: 'i1', status: 'in-progress', isAdult: false }) },
      });
      const saveSpy = vi.spyOn(storageService, 'saveData');

      service.markCompleted('missing');
      service.markDropped('missing');
      service.markStarted('missing');
      service.markPaused('missing');

      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('season release delay', () => {
    function snoozable(overrides: Partial<Item> = {}) {
      return createItem({
        id: 'snoozed',
        status: 'in-progress',
        progress: {
          season: 1,
          episode: 3,
          seasons: [{ seasonNumber: 1, totalEpisodes: 4, firstEpisodeAirDate: '2026-10-01' }],
        },
        ...overrides,
      });
    }

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('accumulates rapid clicks and reverses delay without changing unrelated item data', async () => {
      const original = snoozable();
      await saveData({ items: { snoozed: original } });
      await Promise.all([service.snoozeOneWeek('snoozed'), service.snoozeOneWeek('snoozed')]);
      const updated = service.getItemById('snoozed')!;
      expect(updated).toEqual({
        ...original,
        progress: {
          ...original.progress!,
          seasons: [{ ...original.progress!.seasons[0], snoozeCount: 2 }],
        },
      });
      expect(getCurrentEpisodeAirDate(updated)).toEqual(new Date(2026, 9, 29));
      await service.removeOneWeekDelay('snoozed');
      expect(getCurrentEpisodeAirDate(service.getItemById('snoozed')!)).toEqual(
        new Date(2026, 9, 22),
      );
      await service.removeOneWeekDelay('snoozed');
      await service.removeOneWeekDelay('snoozed');
      expect(service.getItemById('snoozed')!.progress!.seasons[0].snoozeCount).toBe(0);
    });

    it('changes recommendations immediately, retains ordering, and never falls back to a delayed episode', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 20));
      const recommendations = TestBed.inject(RoundRobinService);
      await saveData({
        items: {
          snoozed: snoozable(),
          other: createItem({ id: 'other', status: 'in-progress', createdAt: '2026-10-02' }),
        },
      });
      expect(recommendations.nextSeries()?.id).toBe('snoozed');
      await service.snoozeOneWeek('snoozed');
      expect(recommendations.nextSeries()?.id).toBe('other');
      await service.deleteItem('other');
      expect(recommendations.nextSeries()).toBeNull();
      await service.removeOneWeekDelay('snoozed');
      expect(recommendations.nextSeries()?.id).toBe('snoozed');
      vi.setSystemTime(new Date(2026, 10, 10));
      window.dispatchEvent(new Event('focus'));
      await service.snoozeOneWeek('snoozed');
      expect(recommendations.nextSeries()?.id).toBe('snoozed');
    });

    it('rolls back a failed write and recommendation, and the next queued click starts from the saved count', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 20));
      const recommendations = TestBed.inject(RoundRobinService);
      await saveData({ items: { snoozed: snoozable() } });
      const original = service.getItemById('snoozed');
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const storage = storageService as unknown as { writeData: () => Promise<void> };
      vi.spyOn(storage, 'writeData').mockRejectedValueOnce(new Error('Disk full'));
      await expect(service.snoozeOneWeek('snoozed')).rejects.toThrow('Disk full');
      expect(service.getItemById('snoozed')).toEqual(original);
      expect(recommendations.nextSeries()?.id).toBe('snoozed');

      vi.spyOn(storage, 'writeData').mockRejectedValueOnce(new Error('Disk full'));
      const failed = service.snoozeOneWeek('snoozed');
      const succeeded = service.snoozeOneWeek('snoozed');
      await expect(failed).rejects.toThrow('Disk full');
      await succeeded;
      expect(service.getItemById('snoozed')!.progress!.seasons[0].snoozeCount).toBe(1);
      expect(recommendations.nextSeries()).toBeNull();
    });

    it.each(['series', 'ova', 'ona'] as const)(
      'allows %s to snooze and remove delay with a cleared baseline',
      async (type) => {
        await saveData({ items: { snoozed: snoozable({ type }) } });
        await service.snoozeOneWeek('snoozed');
        const item = service.getItemById('snoozed')!;
        item.progress!.seasons[0].firstEpisodeAirDate = undefined;
        await service.updateItem(item);
        await service.removeOneWeekDelay('snoozed');
        expect(service.getItemById('snoozed')!.progress!.seasons[0].snoozeCount).toBe(0);
      },
    );

    it('does not write for invalid targets, unusable dates, or unsafe increments', async () => {
      for (const item of [
        snoozable({ type: 'movie' }),
        snoozable({ status: 'paused' }),
        snoozable({ status: 'completed' }),
        snoozable({ progress: undefined }),
        snoozable({ progress: { season: 2, episode: 1, seasons: [] } }),
        ...[undefined, '2026-02-31', 'bad'].map((firstEpisodeAirDate) =>
          snoozable({
            progress: {
              season: 1,
              episode: 1,
              seasons: [{ seasonNumber: 1, firstEpisodeAirDate }],
            },
          }),
        ),
        ...[-1, 0.5, Number.MAX_SAFE_INTEGER, 1e12].map((snoozeCount) =>
          snoozable({
            progress: {
              season: 1,
              episode: 1,
              seasons: [{ seasonNumber: 1, firstEpisodeAirDate: '2026-10-01', snoozeCount }],
            },
          }),
        ),
      ]) {
        await saveData({ items: { snoozed: item } });
        const spy = vi.spyOn(storageService, 'saveData');
        await service.snoozeOneWeek('snoozed');
        await service.snoozeOneWeek('missing');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      }
    });

    it('preserves each season count when watching episodes and advancing seasons', async () => {
      const item = snoozable();
      item.progress!.seasons[0].snoozeCount = 2;
      item.progress!.seasons.push({
        seasonNumber: 2,
        firstEpisodeAirDate: '2027-01-07',
        snoozeCount: 1,
      });
      await saveData({ items: { snoozed: item } });
      service.markWatched('snoozed');
      expect(service.getItemById('snoozed')!.progress!.episode).toBe(4);
      expect(service.getItemById('snoozed')!.progress!.seasons).toEqual(item.progress!.seasons);
      service.markWatched('snoozed');
      const updated = service.getItemById('snoozed')!;
      expect(updated.progress!.season).toBe(2);
      expect(updated.progress!.seasons).toEqual(item.progress!.seasons);
      expect(getCurrentEpisodeAirDate(updated)).toEqual(new Date(2027, 0, 14));
    });
  });

  describe('getItemById', () => {
    it('returns the matching item', () => {
      const item = createItem({ id: 'i1', title: 'Found' });
      saveData({ items: { i1: item } });

      expect(service.getItemById('i1')).toEqual(item);
    });

    it('returns undefined for an unknown id', () => {
      expect(service.getItemById('missing')).toBeUndefined();
    });
  });

  describe('getAllWatchHistory', () => {
    it('combines active and deleted item history sorted newest first', () => {
      saveData({
        items: {
          active: createItem({
            id: 'active',
            title: 'Active',
            watchHistory: [{ date: '2026-03-01T10:00:00.000Z' }],
          }),
        },
        deletedItems: {
          deleted: {
            itemId: 'deleted',
            itemTitle: 'Deleted',
            itemType: 'movie',
            watchHistory: [{ date: '2026-04-01T10:00:00.000Z' }],
            deletedAt: '2026-04-02T10:00:00.000Z',
          },
        },
      });

      const history = service.getAllWatchHistory();

      expect(history).toHaveLength(2);
      expect(history[0].itemId).toBe('deleted');
      expect(history[0].isDeleted).toBe(true);
      expect(history[1].itemId).toBe('active');
    });
  });

  describe('computed signals', () => {
    it('items exposes all stored items', () => {
      saveData({
        items: {
          a: createItem({ id: 'a' }),
          b: createItem({ id: 'b' }),
        },
      });

      expect(
        service
          .items()
          .map((i) => i.id)
          .sort(),
      ).toEqual(['a', 'b']);
    });

    it('inProgressSeries only includes in-progress series', () => {
      saveData({
        items: {
          series: createItem({
            id: 'series',
            type: 'series',
            status: 'in-progress',
            isAdult: false,
          }),
          movie: createItem({ id: 'movie', type: 'movie', status: 'in-progress', isAdult: false }),
          done: createItem({ id: 'done', type: 'series', status: 'completed', isAdult: false }),
        },
      });

      expect(service.inProgressSeries().map((i) => i.id)).toEqual(['series']);
    });

    it('inProgressMovies only includes in-progress movies', () => {
      saveData({
        items: {
          series: createItem({
            id: 'series',
            type: 'series',
            status: 'in-progress',
            isAdult: false,
          }),
          movie: createItem({ id: 'movie', type: 'movie', status: 'in-progress', isAdult: false }),
        },
      });

      expect(service.inProgressMovies().map((i) => i.id)).toEqual(['movie']);
    });
  });

  function saveData(data?: {
    items?: Record<string, Item>;
    deletedItems?: Record<string, DeletedItemHistory>;
  }): Promise<void> {
    return storageService.saveData({
      schemaVersion: 3,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
      items: data?.items ?? {},
      deletedItems: data?.deletedItems ?? {},
    });
  }

  function createItem(options: Partial<Item> & { id: string }): Item {
    return {
      id: options.id,
      title: options.title ?? 'Item',
      type: options.type ?? 'series',
      groupId: options.groupId ?? 'ungrouped',
      status: options.status ?? 'not-started',
      watchHistory: options.watchHistory ?? [],
      isAdult: options.isAdult ?? false,
      createdAt: options.createdAt ?? '2026-04-01T10:00:00.000Z',
      progress: options.progress,
    };
  }
});
