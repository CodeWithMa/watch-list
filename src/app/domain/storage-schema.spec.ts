import { createDefaultStorageData, normalizeStorageData } from './storage-schema';
import { DEFAULT_GROUP_ID } from './item.constants';

describe('season release delay storage schema', () => {
  function dataWithSeason(season: Record<string, unknown>) {
    return {
      ...createDefaultStorageData(),
      items: {
        series: {
          id: 'series',
          title: 'Series',
          type: 'series',
          groupId: 'ungrouped',
          status: 'in-progress',
          isAdult: false,
          createdAt: '2026-01-01',
          watchHistory: [],
          progress: { season: 1, episode: 3, seasons: [{ seasonNumber: 1, ...season }] },
        },
      },
    };
  }

  it('migrates version 9 without inventing delays or rewriting the baseline', () => {
    const legacy = { ...dataWithSeason({ firstEpisodeAirDate: '2026-10-01' }), schemaVersion: 9 };
    const normalized = normalizeStorageData(legacy);
    expect(normalized.schemaVersion).toBe(10);
    expect(normalized.items['series'].progress?.seasons).toEqual([
      { seasonNumber: 1, firstEpisodeAirDate: '2026-10-01' },
    ]);
  });

  it.each([0, 2, Number.MAX_SAFE_INTEGER])('retains the valid count %s', (snoozeCount) => {
    expect(
      normalizeStorageData(dataWithSeason({ snoozeCount })).items['series'].progress?.seasons[0]
        .snoozeCount,
    ).toBe(snoozeCount);
  });

  it.each([-1, 1.5, '2', null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid count %s through normal invalid-data handling',
    (snoozeCount) => {
      expect(() => normalizeStorageData(dataWithSeason({ snoozeCount }))).toThrow(
        'Invalid migrated data',
      );
    },
  );

  it('retains existing permissive import date validation', () => {
    expect(
      normalizeStorageData(dataWithSeason({ firstEpisodeAirDate: '2026-02-31', snoozeCount: 2 }))
        .items['series'].progress?.seasons[0].snoozeCount,
    ).toBe(2);
  });

  it('drops malformed items during legacy migration and salvages valid records', () => {
    const payload = {
      ...createDefaultStorageData(),
      schemaVersion: 4,
      items: {
        bad: null,
        m1: {
          id: 'm1',
          title: 'Movie',
          type: 'movie',
          groupId: DEFAULT_GROUP_ID,
          status: 'completed',
          createdAt: '2026-01-01',
          watchHistory: [],
        },
      },
    };

    const normalized = normalizeStorageData(payload);

    expect(Object.keys(normalized.items)).toEqual(['m1']);
    expect(normalized.items['m1'].title).toBe('Movie');
    expect(normalized.groups[DEFAULT_GROUP_ID]).toBeDefined();
  });

  it('remaps items pointing at dropped prototype-named groups', () => {
    const payload = {
      ...createDefaultStorageData(),
      items: {
        m1: {
          id: 'm1',
          title: 'Movie',
          type: 'movie',
          groupId: 'toString',
          status: 'completed',
          isAdult: false,
          createdAt: '2026-01-01',
          watchHistory: [],
        },
      },
      groups: {
        toString: { id: 1 },
      },
    };

    const normalized = normalizeStorageData(payload);

    expect(normalized.items['m1'].groupId).toBe(DEFAULT_GROUP_ID);
  });
});
