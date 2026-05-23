import { TestBed } from '@angular/core/testing';
import { RoundRobinService } from './round-robin.service';
import { StorageService } from './storage.service';
import { Item } from '../models/item.model';

describe('RoundRobinService', () => {
  let storageService: StorageService;
  let service: RoundRobinService;
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    const localStorageMock = {
      clear() { Object.keys(store).forEach(key => delete store[key]); },
      getItem(key: string) { return store[key] ?? null; },
      setItem(key: string, value: string) { store[key] = value; }
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

    TestBed.configureTestingModule({});
    storageService = TestBed.inject(StorageService);
    service = TestBed.inject(RoundRobinService);
  });

  it('skips a series when the current episode has not aired yet', () => {
    saveItems([
      createSeries({
        id: 'future',
        title: 'Future Show',
        createdAt: '2026-01-01T10:00:00.000Z',
        firstEpisodeAirDate: '2099-01-01'
      }),
      createSeries({
        id: 'available',
        title: 'Available Show',
        createdAt: '2026-02-01T10:00:00.000Z',
        firstEpisodeAirDate: '2020-01-01'
      })
    ]);

    expect(service.nextSeries()?.id).toBe('available');
  });

  it('returns null when every in-progress series is waiting for an unaired episode', () => {
    saveItems([
      createSeries({
        id: 'future-1',
        title: 'Future Show 1',
        createdAt: '2026-01-01T10:00:00.000Z',
        firstEpisodeAirDate: '2099-01-01'
      }),
      createSeries({
        id: 'future-2',
        title: 'Future Show 2',
        createdAt: '2026-02-01T10:00:00.000Z',
        firstEpisodeAirDate: '2099-02-01'
      })
    ]);

    expect(service.nextSeries()).toBeNull();
  });

  it('keeps series without air-date metadata suggestible', () => {
    const series = createSeries({
      id: 'legacy',
      title: 'Legacy Show',
      createdAt: '2026-01-01T10:00:00.000Z'
    });
    saveItems([series]);

    expect(service.nextSeries()?.id).toBe('legacy');
  });

  it('calculates weekly episode air dates from the first episode air date', () => {
    const series = createSeries({
      id: 'weekly',
      title: 'Weekly Show',
      createdAt: '2026-01-01T10:00:00.000Z',
      episode: 3,
      firstEpisodeAirDate: '2026-05-01'
    });

    expect(service.hasAiredCurrentEpisode(series, new Date(2026, 4, 14))).toBe(false);
    expect(service.hasAiredCurrentEpisode(series, new Date(2026, 4, 15))).toBe(true);
  });

  function saveItems(items: Item[]): void {
    storageService.saveData({
      schemaVersion: 4,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
      items: Object.fromEntries(items.map(item => [item.id, item])),
      deletedItems: {}
    });
  }

  function createSeries(options: {
    id: string;
    title: string;
    createdAt: string;
    episode?: number;
    firstEpisodeAirDate?: string;
    watchHistory?: Item['watchHistory'];
  }): Item {
    return {
      id: options.id,
      title: options.title,
      type: 'series',
      groupId: 'ungrouped',
      status: 'in-progress',
      progress: {
        season: 1,
        episode: options.episode ?? 1,
        seasons: [
          {
            seasonNumber: 1,
            totalEpisodes: 10,
            firstEpisodeAirDate: options.firstEpisodeAirDate
          }
        ]
      },
      watchHistory: options.watchHistory ?? [],
      createdAt: options.createdAt
    };
  }
});
