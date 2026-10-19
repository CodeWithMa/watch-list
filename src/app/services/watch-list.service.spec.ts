import { TestBed } from '@angular/core/testing';
import { WatchListService } from './watch-list.service';
import { StorageService } from './storage.service';
import { Item, SeriesProgress } from '../models/item.model';
import { CURRENT_SCHEMA_VERSION, DeletedItemHistory } from '../models/storage.model';
import { IDBFactory } from 'fake-indexeddb';
import { vi } from 'vitest';
import { RoundRobinService } from './round-robin.service';
import { getCurrentEpisodeAirDate } from '../domain/episode-release';
import { buildItemEditInput, createItemFormValue } from '../domain/item-form';

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
    it('adds a new item with generated id, createdAt and empty watch history', async () => {
      await service.addItem({
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
    it('updates an existing item', async () => {
      const item = createItem({ id: 'i1', title: 'Before' });
      await saveData({ items: { i1: item } });

      await service.updateItem(item.id, { title: 'After' });

      expect(storageService.getData().items['i1'].title).toBe('After');
    });
  });

  describe('availability deferral', () => {
    afterEach(() => {
      TestBed.resetTestingModule();
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('imports an offset expiry without losing the series or its history and expires at the equivalent UTC instant', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-20T10:00:00.000Z'));
      const original = createItem({
        id: 'deferred',
        status: 'in-progress',
        watchHistory: [{ date: '2026-10-19T10:00:00.000Z', season: 1, episode: 1 }],
      });
      const imported = {
        ...original,
        availabilityDeferral: { season: 1, episode: 1, until: '2026-10-20T14:00:00+02:00' },
      };
      await storageService.importData({
        ...storageService.getData(),
        items: { deferred: imported, other: createItem({ id: 'other' }) },
      });
      expect(service.getItemById('deferred')).toEqual(imported);
      const recommendations = TestBed.inject(RoundRobinService);
      expect(recommendations.nextSeries()).toBeNull();
      vi.setSystemTime(new Date('2026-10-20T11:59:59.999Z'));
      window.dispatchEvent(new Event('focus'));
      expect(recommendations.nextSeries()).toBeNull();
      vi.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));
      window.dispatchEvent(new Event('focus'));
      expect(recommendations.nextSeries()?.id).toBe('deferred');
    });

    it('rejects invalid durations and movie or missing targets without changing the collection', async () => {
      await saveData({
        items: {
          deferred: createItem({ id: 'deferred', status: 'in-progress' }),
          movie: createItem({ id: 'movie', type: 'movie', status: 'in-progress' }),
        },
      });
      const before = service.items();
      for (const hours of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, 1e12]) {
        await expect(service.deferEpisode('deferred', hours)).rejects.toThrow('positive whole');
      }
      await expect(service.deferEpisode('movie', 1)).rejects.toThrow(
        'Only a currently watched episode',
      );
      await expect(service.deferEpisode('missing', 1)).rejects.toThrow('no longer exists');
      expect(service.items()).toEqual(before);
    });

    it('rejects malformed persisted deferrals through existing storage validation', async () => {
      await saveData({
        items: { deferred: createItem({ id: 'deferred', status: 'in-progress' }) },
      });
      const before = storageService.getData();
      for (const availabilityDeferral of [
        { season: 0, episode: 1, until: '2026-10-20T12:00:00.000Z' },
        { season: 1, episode: 1.5, until: '2026-10-20T12:00:00.000Z' },
        { season: 1, episode: 1, until: 'not-a-date' },
        { season: 1, episode: 1, until: '2026-02-31T12:00:00.000Z' },
      ]) {
        await expect(
          storageService.importData({
            ...before,
            items: {
              deferred: { ...before.items['deferred'], availabilityDeferral },
            },
          }),
        ).rejects.toThrow('Invalid migrated data');
      }
      expect(storageService.getData()).toEqual(before);
    });

    it('clears a deferral early and immediately restores normal eligibility without changing priority', async () => {
      const original = createItem({ id: 'deferred', status: 'in-progress' });
      await saveData({ items: { deferred: original } });
      const recommendations = TestBed.inject(RoundRobinService);
      await service.deferEpisode('deferred', 1);
      expect(recommendations.nextSeries()).toBeNull();
      await service.updateItem('deferred', { title: 'Renamed' });
      expect(service.getItemById('deferred')?.availabilityDeferral).toBeDefined();
      await service.clearDeferral('deferred');
      expect(service.getItemById('deferred')).toEqual({ ...original, title: 'Renamed' });
      expect(recommendations.nextSeries()?.id).toBe('deferred');
    });

    it('preserves a deferral when adding release metadata materializes the same implicit episode', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-20T10:00:00.000Z'));
      await saveData({
        items: { deferred: createItem({ id: 'deferred', status: 'in-progress' }) },
      });
      await service.deferEpisode('deferred', 12);
      const deferred = service.getItemById('deferred')!;
      const initial = createItemFormValue(deferred);
      await service.updateItem(
        'deferred',
        buildItemEditInput(initial, {
          ...initial,
          seasons: [{ seasonNumber: 1, firstEpisodeAirDate: '2026-10-01' }],
        }),
      );
      const updated = service.getItemById('deferred')!;
      expect(updated.progress).toEqual({
        season: 1,
        episode: 1,
        seasons: [{ seasonNumber: 1, firstEpisodeAirDate: '2026-10-01' }],
      });
      expect(updated.availabilityDeferral).toEqual(deferred.availabilityDeferral);
      expect(updated.watchHistory).toEqual(deferred.watchHistory);
      expect(TestBed.inject(RoundRobinService).nextSeries()).toBeNull();
    });

    it('rejects a stale episode action after a queued progress change', async () => {
      await saveData({
        items: {
          deferred: createItem({
            id: 'deferred',
            status: 'in-progress',
            progress: { season: 1, episode: 1, seasons: [] },
          }),
        },
      });
      const changed = service.markWatched('deferred');
      const deferred = service.deferEpisode('deferred', 1, { season: 1, episode: 1 });
      await changed;
      await expect(deferred).rejects.toThrow('episode changed');
      expect(service.getItemById('deferred')?.availabilityDeferral).toBeUndefined();
    });

    it.each(['series', 'ova', 'ona'] as const)(
      'persists an episode-specific %s deferral across an app restart without changing watch state',
      async (type) => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-20T10:00:00.000Z'));
        const original = createItem({
          id: 'deferred',
          type,
          status: 'in-progress',
          progress: {
            season: 2,
            episode: 3,
            seasons: [{ seasonNumber: 2, firstEpisodeAirDate: '2026-10-01', snoozeCount: 1 }],
          },
          watchHistory: [{ date: '2026-10-19T10:00:00.000Z', season: 2, episode: 2 }],
        });
        await saveData({ items: { deferred: original } });

        const result = await service.deferEpisode('deferred', 2);
        expect(result.durability).toBe('persistent');
        const expected = {
          ...original,
          availabilityDeferral: {
            season: 2,
            episode: 3,
            until: '2026-10-20T12:00:00.000Z',
          },
        };
        expect(service.getItemById('deferred')).toEqual(expected);

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({});
        await TestBed.inject(StorageService).initialize();
        expect(TestBed.inject(WatchListService).getItemById('deferred')).toEqual(expected);
      },
    );

    it('preserves a deferral when removing explicit progress leaves the same implicit episode', async () => {
      await saveData({
        items: {
          deferred: createItem({
            id: 'deferred',
            status: 'in-progress',
            progress: { season: 1, episode: 1, seasons: [] },
          }),
        },
      });
      await service.deferEpisode('deferred', 12);
      const deferral = service.getItemById('deferred')!.availabilityDeferral;
      await service.updateItem('deferred', { progress: null });
      expect(service.getItemById('deferred')?.availabilityDeferral).toEqual(deferral);
      expect(TestBed.inject(RoundRobinService).nextSeries()).toBeNull();
    });

    it.each(['watched', 'season', 'episode', 'remove-progress', 'movie', 'ova', 'ona'])(
      'clears the deferral when episode identity changes via %s',
      async (change) => {
        await saveData({
          items: {
            deferred: createItem({
              id: 'deferred',
              status: 'in-progress',
              progress: { season: 1, episode: change === 'remove-progress' ? 2 : 1, seasons: [] },
            }),
          },
        });
        await service.deferEpisode('deferred', 1);
        expect(service.getItemById('deferred')?.availabilityDeferral).toBeDefined();
        if (change === 'watched') await service.markWatched('deferred');
        else if (change === 'movie' || change === 'ova' || change === 'ona')
          await service.updateItem('deferred', { type: change });
        else
          await service.updateItem('deferred', {
            progress:
              change === 'remove-progress'
                ? null
                : change === 'season'
                  ? { season: 2 }
                  : { episode: 2 },
          });
        expect(service.getItemById('deferred')?.availabilityDeferral).toBeUndefined();
      },
    );
  });

  describe('deleteItem', () => {
    it('moves the item to deletedItems with its watch history', async () => {
      const item = createItem({
        id: 'i1',
        title: 'Gone',
        type: 'series',
        watchHistory: [{ date: '2026-01-01T10:00:00.000Z', season: 1, episode: 2 }],
      });
      await saveData({ items: { i1: item } });

      await service.deleteItem('i1');

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

    it('does nothing when the item does not exist', async () => {
      await saveData({ items: {} });
      await service.deleteItem('missing');
      expect(storageService.getItems()).toEqual([]);
      expect(storageService.getData().deletedItems).toEqual({});
    });
  });

  describe('markWatched', () => {
    it('marks a movie as completed with a watch history entry', async () => {
      const item = createItem({
        id: 'm1',
        title: 'Movie',
        type: 'movie',
        status: 'in-progress',
        isAdult: false,
      });
      await saveData({ items: { m1: item } });

      await service.markWatched('m1');

      const updated = storageService.getData().items['m1'];
      expect(updated.status).toBe('completed');
      expect(updated.watchHistory).toHaveLength(1);
      expect(updated.watchHistory[0].date).toBeDefined();
    });

    it('starts a series without progress at season 1 episode 2', async () => {
      const item = createItem({
        id: 's1',
        title: 'Fresh Series',
        status: 'in-progress',
        isAdult: false,
      });
      await saveData({ items: { s1: item } });

      await service.markWatched('s1');

      const updated = storageService.getData().items['s1'];
      expect(updated.progress!.season).toBe(1);
      expect(updated.progress!.episode).toBe(2);
      expect(updated.watchHistory[0]).toMatchObject({ season: 1, episode: 1 });
    });

    it('marks series as completed when watching last episode of final season', async () => {
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

      await storageService.replaceData({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        lastModifiedAt: '2026-04-01T10:00:00.000Z',
        groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
        items: { 'series-1': item },
        deletedItems: {},
      });

      await service.markWatched('series-1');

      const updatedItem = storageService.getData().items['series-1'];
      expect(updatedItem.status).toBe('completed');
      expect(updatedItem.progress!.episode).toBe(10);
    });

    it('moves to next season episode 1 when watching last episode of current season', async () => {
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

      await storageService.replaceData({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        lastModifiedAt: '2026-04-01T10:00:00.000Z',
        groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
        items: { 'series-2': item },
        deletedItems: {},
      });

      await service.markWatched('series-2');

      const updatedItem = storageService.getData().items['series-2'];
      expect(updatedItem.status).toBe('in-progress');
      expect(updatedItem.progress!.season).toBe(2);
      expect(updatedItem.progress!.episode).toBe(1);
    });

    it('handles non-contiguous season numbers when advancing to next season', async () => {
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

      await storageService.replaceData({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        lastModifiedAt: '2026-04-01T10:00:00.000Z',
        groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
        items: { 'series-3': item },
        deletedItems: {},
      });

      await service.markWatched('series-3');

      const updatedItem = storageService.getData().items['series-3'];
      expect(updatedItem.status).toBe('in-progress');
      expect(updatedItem.progress!.season).toBe(3);
      expect(updatedItem.progress!.episode).toBe(1);
    });
  });

  describe('status transitions', () => {
    it('marks an item as completed', async () => {
      await saveData({
        items: { i1: createItem({ id: 'i1', status: 'in-progress', isAdult: false }) },
      });

      await service.markCompleted('i1');

      expect(storageService.getData().items['i1'].status).toBe('completed');
    });

    it('marks an item as dropped', async () => {
      await saveData({
        items: { i1: createItem({ id: 'i1', status: 'in-progress', isAdult: false }) },
      });

      await service.markDropped('i1');

      expect(storageService.getData().items['i1'].status).toBe('dropped');
    });

    it('marks an item as started', async () => {
      await saveData({
        items: { i1: createItem({ id: 'i1', status: 'not-started', isAdult: false }) },
      });

      await service.markStarted('i1');

      expect(storageService.getData().items['i1'].status).toBe('in-progress');
    });

    it('marks a series as paused', async () => {
      await saveData({
        items: {
          i1: createItem({ id: 'i1', type: 'series', status: 'in-progress', isAdult: false }),
        },
      });

      await service.markPaused('i1');

      expect(storageService.getData().items['i1'].status).toBe('paused');
    });

    it('marks a movie as paused', async () => {
      await saveData({
        items: {
          i1: createItem({ id: 'i1', type: 'movie', status: 'in-progress', isAdult: false }),
        },
      });

      await service.markPaused('i1');

      expect(storageService.getData().items['i1'].status).toBe('paused');
    });

    it('does nothing when the item does not exist', async () => {
      await saveData({
        items: { i1: createItem({ id: 'i1', status: 'in-progress', isAdult: false }) },
      });
      const original = service.items();
      await service.markCompleted('missing');
      await service.markDropped('missing');
      await service.markStarted('missing');
      await service.markPaused('missing');
      expect(service.items()).toEqual(original);
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
        await service.updateItem('snoozed', {
          progress: { seasons: { 1: { firstEpisodeAirDate: undefined } } },
        });
        await service.removeOneWeekDelay('snoozed');
        expect(service.getItemById('snoozed')!.progress!.seasons[0].snoozeCount).toBe(0);
      },
    );

    it('does not change invalid targets, unusable dates, or unsafe increments', async () => {
      for (const item of [
        snoozable({ type: 'movie' }),
        snoozable({ status: 'paused' }),
        snoozable({ status: 'completed' }),
        snoozable({ progress: undefined }),
        snoozable({ progress: { season: 2, episode: 1, seasons: [] } }),
        ...[undefined, '2026-02-31'].map((firstEpisodeAirDate) =>
          snoozable({
            progress: {
              season: 1,
              episode: 1,
              seasons: [{ seasonNumber: 1, firstEpisodeAirDate }],
            },
          }),
        ),
        ...[Number.MAX_SAFE_INTEGER, 1e12].map((snoozeCount) =>
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
        const original = service.items();
        await service.snoozeOneWeek('snoozed');
        await service.snoozeOneWeek('missing');
        expect(service.items()).toEqual(original);
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
      await service.markWatched('snoozed');
      expect(service.getItemById('snoozed')!.progress!.episode).toBe(4);
      expect(service.getItemById('snoozed')!.progress!.seasons).toEqual(item.progress!.seasons);
      await service.markWatched('snoozed');
      const updated = service.getItemById('snoozed')!;
      expect(updated.progress!.season).toBe(2);
      expect(updated.progress!.seasons).toEqual(item.progress!.seasons);
      expect(getCurrentEpisodeAirDate(updated)).toEqual(new Date(2027, 0, 14));
    });
  });

  describe('getItemById', () => {
    it('returns the matching item', async () => {
      const item = createItem({ id: 'i1', title: 'Found' });
      await saveData({ items: { i1: item } });

      expect(service.getItemById('i1')).toEqual(item);
    });

    it('returns undefined for an unknown id', () => {
      expect(service.getItemById('missing')).toBeUndefined();
    });
  });

  describe('getAllWatchHistory', () => {
    it('combines active and deleted item history sorted newest first', async () => {
      await saveData({
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
    it('items exposes all stored items', async () => {
      await saveData({
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

    it('inProgressSeries only includes in-progress series', async () => {
      await saveData({
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

    it('inProgressMovies only includes in-progress movies', async () => {
      await saveData({
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
  }) {
    return storageService.replaceData({
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
