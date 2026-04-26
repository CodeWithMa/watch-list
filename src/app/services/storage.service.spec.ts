import { CURRENT_SCHEMA_VERSION } from '../models/storage.model';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a default dataset when storage is empty', () => {
    const service = new StorageService();
    const data = service.getData();

    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.groups['ungrouped'].name).toBe('Ungrouped');
    expect(data.deletedItems).toEqual({});
  });

  it('normalizes imported legacy data and saves it reactively', () => {
    const service = new StorageService();

    service.importData({
      schemaVersion: 1,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: {},
      items: {
        legacy: {
          id: 'legacy',
          title: 'Legacy Series',
          type: 'series',
          groupId: 'missing-group',
          status: 'in-progress',
          createdAt: '2026-03-01T10:00:00.000Z',
          lastWatchedAt: '2026-03-02T12:00:00.000Z',
          progress: {
            season: 1,
            episode: 0,
            totalEpisodes: 12
          }
        }
      }
    });

    const data = service.getData();
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.groups['ungrouped']).toBeDefined();
    expect(data.deletedItems).toEqual({});
    expect(data.items['legacy'].progress?.episode).toBe(1);
    expect(data.items['legacy'].watchHistory).toEqual([
      {
        date: '2026-03-02T12:00:00.000Z',
        season: 1,
        episode: 0
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
