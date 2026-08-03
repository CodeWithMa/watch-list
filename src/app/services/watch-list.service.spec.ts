import { TestBed } from '@angular/core/testing';
import { WatchListService } from './watch-list.service';
import { StorageService } from './storage.service';
import { Item, SeriesProgress } from '../models/item.model';
import { IDBFactory } from 'fake-indexeddb';

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

  describe('markWatched', () => {
    it('marks series as completed when watching last episode of final season', () => {
      const item: Item = {
        id: 'series-1',
        title: 'Test Series',
        type: 'series',
        groupId: 'ungrouped',
        status: 'in-progress',
        progress: {
          season: 1,
          episode: 10,
          seasons: [{ seasonNumber: 1, totalEpisodes: 10 }],
        } as SeriesProgress,
        watchHistory: [],
        createdAt: '2026-04-01T10:00:00.000Z',
      };

      storageService.saveData({
        schemaVersion: 3,
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
        schemaVersion: 3,
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
        schemaVersion: 3,
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
});
