import { TestBed } from '@angular/core/testing';
import { RoundRobinService } from './round-robin.service';
import { StorageService } from './storage.service';
import { IDBFactory } from 'fake-indexeddb';
import { Item } from '../models/item.model';
import { CURRENT_SCHEMA_VERSION } from '../models/storage.model';

describe('RoundRobinService', () => {
  let storageService: StorageService;
  let service: RoundRobinService;

  beforeEach(async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: new IDBFactory(),
    });
    TestBed.configureTestingModule({});
    storageService = TestBed.inject(StorageService);
    await storageService.initialize();
    service = TestBed.inject(RoundRobinService);
  });

  it('skips a series when the current episode has not aired yet', () => {
    saveItems([
      createSeries({
        id: 'future',
        title: 'Future Show',
        createdAt: '2026-01-01T10:00:00.000Z',
        firstEpisodeAirDate: '2099-01-01',
      }),
      createSeries({
        id: 'available',
        title: 'Available Show',
        createdAt: '2026-02-01T10:00:00.000Z',
        firstEpisodeAirDate: '2020-01-01',
      }),
    ]);

    expect(service.nextSeries()?.id).toBe('available');
  });

  it('returns null when every in-progress series is waiting for an unaired episode', () => {
    saveItems([
      createSeries({
        id: 'future-1',
        title: 'Future Show 1',
        createdAt: '2026-01-01T10:00:00.000Z',
        firstEpisodeAirDate: '2099-01-01',
      }),
      createSeries({
        id: 'future-2',
        title: 'Future Show 2',
        createdAt: '2026-02-01T10:00:00.000Z',
        firstEpisodeAirDate: '2099-02-01',
      }),
    ]);

    expect(service.nextSeries()).toBeNull();
  });

  it('keeps series without air-date metadata suggestible', () => {
    const series = createSeries({
      id: 'legacy',
      title: 'Legacy Show',
      createdAt: '2026-01-01T10:00:00.000Z',
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
      firstEpisodeAirDate: '2026-05-01',
    });

    expect(service.hasAiredCurrentEpisode(series, new Date(2026, 4, 14))).toBe(false);
    expect(service.hasAiredCurrentEpisode(series, new Date(2026, 4, 15))).toBe(true);
  });

  it('returns null when no in-progress series', () => {
    saveItems([]);
    expect(service.nextSeries()).toBeNull();
  });

  it('returns oldest unwatched series first (sorted by last watched date)', () => {
    saveItems([
      createSeries({
        id: 'a',
        title: 'A',
        createdAt: '2026-01-01T00:00:00.000Z',
        watchHistory: [{ date: '2026-04-10T00:00:00.000Z' }],
      }),
      createSeries({
        id: 'b',
        title: 'B',
        createdAt: '2026-01-02T00:00:00.000Z',
        watchHistory: [{ date: '2026-04-01T00:00:00.000Z' }],
      }),
    ]);
    // b has older last watched, should be suggested first
    expect(service.nextSeries()?.id).toBe('b');
  });

  it('implements round-robin when all others have been watched', () => {
    // Two series, 'a' oldest but 'b' has no watch history, so canSuggest for 'b' is false, for 'a' is true? Let's craft
    // canSuggest checks if all otherSeries have watchHistory length >0
    // If b has empty history, then for target a, other=b has empty => allOthersWatched false => canSuggest false for a
    // For target b, other=a has history => true => canSuggest true for b => b should be returned
    saveItems([
      createSeries({
        id: 'a',
        title: 'A',
        createdAt: '2026-01-01T00:00:00.000Z',
        watchHistory: [{ date: '2026-04-01T00:00:00.000Z' }],
        firstEpisodeAirDate: '2020-01-01',
      }),
      createSeries({
        id: 'b',
        title: 'B',
        createdAt: '2026-01-02T00:00:00.000Z',
        watchHistory: [],
        firstEpisodeAirDate: '2020-01-01',
      }),
    ]);
    // sorted by last watched: b (no history => uses createdAt? actually getMostRecentWatchDate falls back to createdAt)
    // For b, lastWatched is createdAt 2026-01-02, for a it's 2026-04-01, so b is older => watchable sorted [b,a]
    // Loop: canSuggest(b) -> other=a has history => true => return b
    expect(service.nextSeries()?.id).toBe('b');
  });

  it('falls back to first watchable when no series can be suggested', () => {
    // Both have empty history, so for each, allOthersWatched is false (other has empty)
    // No canSuggest true, should return watchable[0] (oldest)
    saveItems([
      createSeries({
        id: 'a',
        title: 'A',
        createdAt: '2026-01-01T00:00:00.000Z',
        watchHistory: [],
        firstEpisodeAirDate: '2020-01-01',
      }),
      createSeries({
        id: 'b',
        title: 'B',
        createdAt: '2026-01-02T00:00:00.000Z',
        watchHistory: [],
        firstEpisodeAirDate: '2020-01-01',
      }),
    ]);
    const result = service.nextSeries();
    expect(result).not.toBeNull();
    // watchable sorted [a,b] because both have same fallback? a older
    expect(result?.id).toBe('a');
  });

  it('handles single series case (canSuggest always true)', () => {
    saveItems([
      createSeries({
        id: 'only',
        title: 'Only',
        createdAt: '2026-01-01T00:00:00.000Z',
        firstEpisodeAirDate: '2020-01-01',
      }),
    ]);
    expect(service.nextSeries()?.id).toBe('only');
  });

  it('nextMovie returns null when no movies and sorted oldest first', () => {
    saveItems([]);
    expect(service.nextMovie()).toBeNull();

    saveItems([
      {
        id: 'm1',
        title: 'Movie 1',
        type: 'movie',
        groupId: 'ungrouped',
        status: 'in-progress',
        isAdult: false,
        watchHistory: [{ date: '2026-04-10T00:00:00.000Z' }],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'm2',
        title: 'Movie 2',
        type: 'movie',
        groupId: 'ungrouped',
        status: 'in-progress',
        isAdult: false,
        watchHistory: [{ date: '2026-04-01T00:00:00.000Z' }],
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    expect(service.nextMovie()?.id).toBe('m2');
  });

  it('hasAiredCurrentEpisode returns true for non-episodic or missing progress', () => {
    const movie: Item = {
      id: 'm1',
      title: 'Movie',
      type: 'movie',
      groupId: 'ungrouped',
      status: 'in-progress',
      isAdult: false,
      watchHistory: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      progress: {
        season: 1,
        episode: 1,
        seasons: [{ seasonNumber: 1, totalEpisodes: 10, firstEpisodeAirDate: '2099-01-01' }],
      },
    };
    expect(service.hasAiredCurrentEpisode(movie)).toBe(true);

    const noProgress: Item = {
      id: 's1',
      title: 'Series',
      type: 'series',
      groupId: 'ungrouped',
      status: 'in-progress',
      isAdult: false,
      watchHistory: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    expect(service.hasAiredCurrentEpisode(noProgress)).toBe(true);

    const noAirDate = createSeries({
      id: 's2',
      title: 'S2',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(service.hasAiredCurrentEpisode(noAirDate)).toBe(true);
  });

  it('hasAiredCurrentEpisode returns true for invalid air date or missing episode date', () => {
    const invalidDate = createSeries({
      id: 'inv',
      title: 'Inv',
      createdAt: '2026-01-01T00:00:00.000Z',
      firstEpisodeAirDate: 'not-a-date',
    });
    expect(service.hasAiredCurrentEpisode(invalidDate)).toBe(true);

    const missingSeason = createSeries({
      id: 'miss',
      title: 'Miss',
      createdAt: '2026-01-01T00:00:00.000Z',
      episode: 2,
      firstEpisodeAirDate: '2026-05-01',
    });
    // Change progress to season 2 but seasons only has season 1
    (missingSeason as Item).progress = {
      season: 2,
      episode: 1,
      seasons: [{ seasonNumber: 1, totalEpisodes: 10, firstEpisodeAirDate: '2026-05-01' }],
    };
    expect(service.hasAiredCurrentEpisode(missingSeason)).toBe(true);
  });

  it('hasAiredCurrentEpisode handles episode offset correctly', () => {
    const series = createSeries({
      id: 's',
      title: 'S',
      createdAt: '2026-01-01T00:00:00.000Z',
      episode: 1,
      firstEpisodeAirDate: '2026-05-01',
    });
    expect(service.hasAiredCurrentEpisode(series, new Date(2026, 4, 1))).toBe(true);
    const ep2 = createSeries({
      id: 's2',
      title: 'S2',
      createdAt: '2026-01-01T00:00:00.000Z',
      episode: 2,
      firstEpisodeAirDate: '2026-05-01',
    });
    expect(service.hasAiredCurrentEpisode(ep2, new Date(2026, 4, 7))).toBe(false);
    expect(service.hasAiredCurrentEpisode(ep2, new Date(2026, 4, 8))).toBe(true);
  });

  it('getEpisodeAirDate returns null for invalid year/month/day', () => {
    const badYear = createSeries({
      id: 'bad',
      title: 'Bad',
      createdAt: '2026-01-01T00:00:00.000Z',
      firstEpisodeAirDate: 'bad-01-01',
    });
    expect(service.hasAiredCurrentEpisode(badYear)).toBe(true);

    const badMonth = createSeries({
      id: 'bad2',
      title: 'Bad2',
      createdAt: '2026-01-01T00:00:00.000Z',
      firstEpisodeAirDate: '2026-00-01',
    });
    // year 2026 ok, month 0 -> falsy? 0 is falsy, so returns null
    expect(service.hasAiredCurrentEpisode(badMonth)).toBe(true);
  });

  function saveItems(items: Item[]): void {
    storageService.saveData({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: { ungrouped: { id: 'ungrouped', name: 'Ungrouped', order: 0 } },
      items: Object.fromEntries(items.map((item) => [item.id, item])),
      deletedItems: {},
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
      isAdult: false,
      progress: {
        season: 1,
        episode: options.episode ?? 1,
        seasons: [
          {
            seasonNumber: 1,
            totalEpisodes: 10,
            firstEpisodeAirDate: options.firstEpisodeAirDate,
          },
        ],
      },
      watchHistory: options.watchHistory ?? [],
      createdAt: options.createdAt,
    };
  }
});
