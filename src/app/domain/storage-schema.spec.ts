import { createDefaultStorageData, normalizeStorageData } from './storage-schema';
import { DEFAULT_GROUP_ID } from './item.constants';
import { CURRENT_SCHEMA_VERSION } from '../models/storage.model';

describe('safe supported domain data', () => {
  const movie = {
    id: 'movie',
    type: 'movie',
    title: 'A valid movie',
    groupId: DEFAULT_GROUP_ID,
    status: 'completed',
    isAdult: false,
    createdAt: '2024-02-29',
    watchHistory: [{ date: '2026-01-02T12:00:00+02:00' }],
  };

  it.each(['__proto__', 'constructor', 'toString'])(
    'preserves a valid own-key identity %s without silently omitting it',
    (id) => {
      const special = { ...movie, id };
      const input = {
        ...createDefaultStorageData(),
        items: Object.fromEntries([
          ['movie', movie],
          [id, special],
        ]),
      };
      const result = normalizeStorageData(input);
      expect(Object.keys(result.data.items)).toEqual(['movie', id]);
      expect(Object.hasOwn(result.data.items, id)).toBe(true);
      expect(result.data.items[id]).toEqual(special);
      expect(result.dropped.items).toBe(0);
    },
  );

  it('preserves valid records when a legacy modification timestamp is not a date', () => {
    const result = normalizeStorageData({
      ...createDefaultStorageData(),
      lastModifiedAt: 'legacy timestamp',
      items: { movie },
    });
    expect(result.data.items).toEqual({ movie });
    expect(result.dropped.items).toBe(0);
  });

  it('rejects an all-invalid collection even when its only supplied item has a prototype-named key', () => {
    expect(() =>
      normalizeStorageData({
        ...createDefaultStorageData(),
        items: JSON.parse('{"__proto__":{"invalid":true}}'),
      }),
    ).toThrow('Invalid migrated data');
  });

  it.each([
    { title: '' },
    { title: ' \t\n' },
    { createdAt: 'not-a-date' },
    { createdAt: '2026-02-29' },
    { watchHistory: [{ date: '2026-02-31T12:00:00Z' }] },
    { watchHistory: [{ date: '' }] },
    { watchHistory: [{ date: '2026-01-02', season: 0 }] },
    { watchHistory: [{ date: '2026-01-02', episode: 1.5 }] },
  ])('quarantines unsafe records without losing a valid neighbor: %j', (unsafe) => {
    const result = normalizeStorageData({
      ...createDefaultStorageData(),
      items: { movie, bad: { ...movie, id: 'bad', ...unsafe } },
    });

    expect(result.data.items).toEqual({ movie });
    expect(result.dropped).toEqual({ groups: 0, items: 1, deletedItems: 0 });
  });

  it.each(['missing', 'toString', '__proto__'])(
    'repairs a dangling group %s even in clean data',
    (groupId) => {
      const input = { ...createDefaultStorageData(), items: { movie: { ...movie, groupId } } };
      const result = normalizeStorageData(input);

      expect(result.data.items['movie'].groupId).toBe(DEFAULT_GROUP_ID);
      expect(result).toMatchObject({
        dropped: { groups: 0, items: 0, deletedItems: 0 },
        repairedGroupReferences: 1,
      });
      expect(input.items.movie.groupId).toBe(groupId);
    },
  );

  it('quarantines mismatched identities without duplicating or losing unrelated records', () => {
    const result = normalizeStorageData({
      ...createDefaultStorageData(),
      groups: { alias: { id: 'ungrouped', name: 'Alias', order: 1 } },
      items: {
        movie,
        alias: { ...movie, groupId: 'alias' },
        other: { ...movie, id: 'other', groupId: 'alias' },
      },
      deletedItems: {
        alias: {
          itemId: 'movie',
          itemTitle: 'Deleted',
          itemType: 'movie',
          watchHistory: [],
          deletedAt: '2026-01-03',
        },
      },
    });

    expect(Object.keys(result.data.items)).toEqual(['movie', 'other']);
    expect(result.data.items['other'].groupId).toBe(DEFAULT_GROUP_ID);
    expect(Object.keys(result.data.groups)).toEqual([DEFAULT_GROUP_ID]);
    expect(result.data.deletedItems).toEqual({});
    expect(result).toMatchObject({
      dropped: { groups: 1, items: 1, deletedItems: 1 },
      repairedGroupReferences: 1,
    });
  });

  it.each(['12', null, 0, -1, 1.5, NaN, Infinity])(
    'does not hide an unsafe legacy episode total %j during migration',
    (totalEpisodes) => {
      const result = normalizeStorageData({
        ...createDefaultStorageData(),
        schemaVersion: 2,
        items: {
          movie,
          bad: {
            ...movie,
            id: 'bad',
            type: 'series',
            progress: { season: 1, episode: 1, totalEpisodes },
          },
        },
      });
      expect(Object.keys(result.data.items)).toEqual(['movie']);
      expect(result.dropped.items).toBe(1);
    },
  );

  it.each([0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unsafe season/episode values and totals %s in every supported field',
    (value) => {
      const progress = { season: 1, episode: 1, seasons: [{ seasonNumber: 1, totalEpisodes: 12 }] };
      const invalidFields = [
        { progress: { ...progress, season: value } },
        { progress: { ...progress, episode: value } },
        { progress: { ...progress, seasons: [{ seasonNumber: value }] } },
        { progress: { ...progress, seasons: [{ seasonNumber: 1, totalEpisodes: value }] } },
        { watchHistory: [{ date: '2026-01-01', season: value }] },
        { watchHistory: [{ date: '2026-01-01', episode: value }] },
      ];
      for (const fields of invalidFields) {
        const result = normalizeStorageData({
          ...createDefaultStorageData(),
          items: { movie, bad: { ...movie, id: 'bad', type: 'series', ...fields } },
        });
        expect(Object.keys(result.data.items)).toEqual(['movie']);
        expect(result.dropped.items).toBe(1);
      }
    },
  );

  it('preserves date-only history and optional or permissive release metadata', () => {
    const legacy = {
      ...createDefaultStorageData(),
      schemaVersion: 4,
      items: {
        movie: { ...movie, watchHistory: [{ date: '2024-02-29' }] },
        series: {
          ...movie,
          id: 'series',
          type: 'series',
          progress: {
            season: 2,
            episode: 1,
            seasons: [
              { seasonNumber: 1 },
              { seasonNumber: 2, totalEpisodes: 12, firstEpisodeAirDate: '2026-02-31' },
            ],
          },
        },
      },
    };
    const result = normalizeStorageData(legacy);
    expect(result.data.items).toEqual(legacy.items);
    expect(result).toMatchObject({
      dropped: { groups: 0, items: 0, deletedItems: 0 },
      repairedGroupReferences: 0,
    });
  });

  it.each([
    { itemTitle: ' ' },
    { deletedAt: '2026-02-30' },
    { watchHistory: [{ date: 'invalid' }] },
    { watchHistory: [{ date: '2026-01-01', episode: 0 }] },
  ])('quarantines unsafe deleted history %j', (fields) => {
    const result = normalizeStorageData({
      ...createDefaultStorageData(),
      items: { movie },
      deletedItems: {
        bad: {
          itemId: 'bad',
          itemTitle: 'Deleted',
          itemType: 'series',
          deletedAt: '2026-01-01',
          watchHistory: [],
          ...fields,
        },
      },
    });
    expect(result.data.items).toEqual({ movie });
    expect(result.data.deletedItems).toEqual({});
    expect(result.dropped.deletedItems).toBe(1);
  });
});

describe('storage version compatibility', () => {
  it('rejects newer versions before interpreting their records as supported data', () => {
    const newer = {
      ...createDefaultStorageData(),
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      futureSettings: { layout: 'timeline' },
      items: { future: { type: 'interactive', metadata: { chapters: [1, 2] } } },
    };
    const original = structuredClone(newer);

    expect(() => normalizeStorageData(newer)).toThrow(/newer version of Watch List/);
    expect(newer).toEqual(original);
    // A future schema may replace today's required fields entirely.
    expect(() => normalizeStorageData({ schemaVersion: newer.schemaVersion })).toThrow(
      /newer version of Watch List/,
    );
    expect(() => normalizeStorageData({ schemaVersion: CURRENT_SCHEMA_VERSION })).toThrow(
      'Invalid data format',
    );
  });
});

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
    const normalized = normalizeStorageData(legacy).data;
    expect(normalized.schemaVersion).toBe(10);
    expect(normalized.items['series'].progress?.seasons).toEqual([
      { seasonNumber: 1, firstEpisodeAirDate: '2026-10-01' },
    ]);
  });

  it.each([0, 2, Number.MAX_SAFE_INTEGER])('retains the valid count %s', (snoozeCount) => {
    expect(
      normalizeStorageData(dataWithSeason({ snoozeCount })).data.items['series'].progress
        ?.seasons[0].snoozeCount,
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
        .data.items['series'].progress?.seasons[0].snoozeCount,
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

    expect(Object.keys(normalized.data.items)).toEqual(['m1']);
    expect(normalized.data.items['m1'].title).toBe('Movie');
    expect(normalized.data.groups[DEFAULT_GROUP_ID]).toBeDefined();
    expect(normalized.dropped).toEqual({ groups: 0, items: 1, deletedItems: 0 });
  });

  it.each(['corrupt', 42, true, [], null])(
    'salvages valid v2 series when another series has malformed progress %j',
    (progress) => {
      const valid = dataWithSeason({});
      const series = valid.items.series;
      const normalized = normalizeStorageData({
        ...valid,
        schemaVersion: 2,
        items: {
          series: {
            ...series,
            progress: { season: 1, episode: 3, totalEpisodes: 12, totalSeasons: 1 },
          },
          bad: { ...series, id: 'bad', progress },
        },
      });

      expect(Object.keys(normalized.data.items)).toEqual(['series']);
      expect(normalized.data.items['series'].progress).toEqual({
        season: 1,
        episode: 3,
        seasons: [{ seasonNumber: 1, totalEpisodes: 12 }],
      });
      expect(normalized.dropped).toEqual({ groups: 0, items: 1, deletedItems: 0 });
    },
  );

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

    expect(normalized.data.items['m1'].groupId).toBe(DEFAULT_GROUP_ID);
    expect(normalized.dropped).toEqual({ groups: 1, items: 0, deletedItems: 0 });
  });

  it('reports zero dropped records for clean data', () => {
    const normalized = normalizeStorageData(createDefaultStorageData());

    expect(normalized.dropped).toEqual({ groups: 0, items: 0, deletedItems: 0 });
  });
});
