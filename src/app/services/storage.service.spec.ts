import { CURRENT_SCHEMA_VERSION } from '../models/storage.model';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        clear() { Object.keys(store).forEach(key => delete store[key]); },
        getItem(key: string) { return store[key] ?? null; },
        setItem(key: string, value: string) { store[key] = value; }
      },
      writable: true
    });
  });

  it('creates a default dataset when storage is empty', () => {
    const service = new StorageService();
    const data = service.getData();

    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.groups['ungrouped'].name).toBe('Ungrouped');
    expect(data.deletedItems).toEqual({});
  });

  it('migrates v2 data with totalEpisodes to v3 seasons array', () => {
    const service = new StorageService();

    service.importData({
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
          createdAt: '2026-03-01T10:00:00.000Z',
          progress: {
            season: 2,
            episode: 3,
            totalEpisodes: 10,
            totalSeasons: 3
          },
          watchHistory: [
            {
              date: '2026-03-02T12:00:00.000Z',
              season: 2,
              episode: 3
            }
          ]
        }
      }
    });

    const data = service.getData();
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    const progress = data.items['series1'].progress!;
    expect(progress.seasons).toEqual([
      { seasonNumber: 2, totalEpisodes: 10 }
    ]);
    expect('totalEpisodes' in progress).toBe(false);
    expect('totalSeasons' in progress).toBe(false);
    expect(data.items['series1'].watchHistory).toEqual([
      {
        date: '2026-03-02T12:00:00.000Z',
        season: 2,
        episode: 3
      }
    ]);
  });

  it('rejects invalid imports', () => {
    const service = new StorageService();

    expect(() =>
      service.importData({
        schemaVersion: 2,
        lastModifiedAt: '2026-04-01T10:00:00.000Z',
        groups: {},
        items: []
      })
    ).toThrowError('Invalid data format');
  });
});
