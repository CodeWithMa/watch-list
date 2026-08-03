import { CURRENT_SCHEMA_VERSION } from '../models/storage.model';
import { StorageService } from './storage.service';
import 'fake-indexeddb/auto';

describe('StorageService', () => {
  it('creates a default dataset when storage is empty', async () => {
    const service = new StorageService();
    await service.initialize();
    const data = service.getData();

    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.groups['ungrouped'].name).toBe('Ungrouped');
    expect(data.deletedItems).toEqual({});
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

  it('migrates v2 data with totalEpisodes to the current seasons array', async () => {
    const service = new StorageService();
    await service.initialize();

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

    service.importData({
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
});
