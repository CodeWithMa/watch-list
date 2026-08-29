import { Item } from '../models/item.model';
import {
  compareItems,
  isSortDirection,
  isSortField,
  sortItems,
  SORT_DIRECTION_LABELS,
  SORT_FIELD_LABELS,
} from './sort.utils';

function item(overrides: Partial<Item> & Pick<Item, 'id' | 'title'>): Item {
  return {
    type: 'series',
    groupId: 'ungrouped',
    status: 'not-started',
    watchHistory: [],
    createdAt: '2026-04-01T10:00:00.000Z',
    ...overrides,
  } as Item;
}

describe('sort.utils', () => {
  describe('isSortField', () => {
    it('validates sort fields', () => {
      expect(isSortField('title')).toBe(true);
      expect(isSortField('createdAt')).toBe(true);
      expect(isSortField('lastWatched')).toBe(true);
      expect(isSortField('name')).toBe(false);
      expect(isSortField('')).toBe(false);
      expect(isSortField(null)).toBe(false);
    });
  });

  describe('isSortDirection', () => {
    it('validates sort directions', () => {
      expect(isSortDirection('asc')).toBe(true);
      expect(isSortDirection('desc')).toBe(true);
      expect(isSortDirection('ascending')).toBe(false);
      expect(isSortDirection(null)).toBe(false);
    });
  });

  describe('labels', () => {
    it('has labels for fields', () => {
      expect(SORT_FIELD_LABELS.title).toBe('Title');
      expect(SORT_FIELD_LABELS.createdAt).toBe('Added date');
      expect(SORT_FIELD_LABELS.lastWatched).toBe('Last watched date');
    });

    it('has labels for directions', () => {
      expect(SORT_DIRECTION_LABELS.asc).toBe('Ascending');
      expect(SORT_DIRECTION_LABELS.desc).toBe('Descending');
    });
  });

  describe('compareItems by title', () => {
    it('sorts ascending case-insensitive', () => {
      const a = item({ id: 'a', title: 'banana' });
      const b = item({ id: 'b', title: 'Apple' });
      expect(compareItems(a, b, 'title', 'asc')).toBeGreaterThan(0);
      expect(compareItems(b, a, 'title', 'asc')).toBeLessThan(0);
    });

    it('sorts descending', () => {
      const a = item({ id: 'a', title: 'Apple' });
      const b = item({ id: 'b', title: 'banana' });
      expect(compareItems(a, b, 'title', 'desc')).toBeGreaterThan(0);
      expect(compareItems(b, a, 'title', 'desc')).toBeLessThan(0);
    });

    it('returns 0 for equal titles', () => {
      const a = item({ id: 'a', title: 'Same' });
      const b = item({ id: 'b', title: 'Same' });
      expect(compareItems(a, b, 'title', 'asc')).toBe(0);
      expect(compareItems(a, b, 'title', 'desc')).toBe(0);
    });

    it('treats case variations as equal', () => {
      const a = item({ id: 'a', title: 'apple' });
      const b = item({ id: 'b', title: 'Apple' });
      expect(compareItems(a, b, 'title', 'asc')).toBe(0);
    });
  });

  describe('compareItems by createdAt', () => {
    it('sorts ascending (older first)', () => {
      const a = item({ id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00.000Z' });
      const b = item({ id: 'b', title: 'B', createdAt: '2026-03-01T00:00:00.000Z' });
      expect(compareItems(a, b, 'createdAt', 'asc')).toBeLessThan(0);
      expect(compareItems(b, a, 'createdAt', 'asc')).toBeGreaterThan(0);
    });

    it('sorts descending (newer first)', () => {
      const a = item({ id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00.000Z' });
      const b = item({ id: 'b', title: 'B', createdAt: '2026-03-01T00:00:00.000Z' });
      expect(compareItems(a, b, 'createdAt', 'desc')).toBeGreaterThan(0);
      expect(compareItems(b, a, 'createdAt', 'desc')).toBeLessThan(0);
    });

    it('returns 0 for equal dates', () => {
      const a = item({ id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00.000Z' });
      const b = item({ id: 'b', title: 'B', createdAt: '2026-01-01T00:00:00.000Z' });
      expect(compareItems(a, b, 'createdAt', 'asc')).toBe(0);
    });
  });

  describe('compareItems by lastWatched', () => {
    it('sorts by most recent watchHistory date ascending', () => {
      const a = item({
        id: 'a',
        title: 'A',
        watchHistory: [{ date: '2026-02-01T00:00:00.000Z' }],
      });
      const b = item({
        id: 'b',
        title: 'B',
        watchHistory: [{ date: '2026-04-01T00:00:00.000Z' }],
      });
      expect(compareItems(a, b, 'lastWatched', 'asc')).toBeLessThan(0);
      expect(compareItems(b, a, 'lastWatched', 'asc')).toBeGreaterThan(0);
    });

    it('sorts descending', () => {
      const a = item({
        id: 'a',
        title: 'A',
        watchHistory: [{ date: '2026-02-01T00:00:00.000Z' }],
      });
      const b = item({
        id: 'b',
        title: 'B',
        watchHistory: [{ date: '2026-04-01T00:00:00.000Z' }],
      });
      expect(compareItems(a, b, 'lastWatched', 'desc')).toBeGreaterThan(0);
      expect(compareItems(b, a, 'lastWatched', 'desc')).toBeLessThan(0);
    });

    it('picks most recent entry when multiple history entries', () => {
      const a = item({
        id: 'a',
        title: 'A',
        watchHistory: [
          { date: '2026-01-01T00:00:00.000Z' },
          { date: '2026-06-01T00:00:00.000Z' },
          { date: '2026-03-01T00:00:00.000Z' },
        ],
      });
      const b = item({
        id: 'b',
        title: 'B',
        watchHistory: [{ date: '2026-05-01T00:00:00.000Z' }],
      });
      // a lastWatched is 2026-06-01 > b 2026-05-01
      expect(compareItems(a, b, 'lastWatched', 'asc')).toBeGreaterThan(0);
      expect(compareItems(b, a, 'lastWatched', 'asc')).toBeLessThan(0);
    });

    it('falls back to createdAt when no watchHistory', () => {
      const a = item({
        id: 'a',
        title: 'A',
        createdAt: '2026-01-01T00:00:00.000Z',
        watchHistory: [],
      });
      const b = item({
        id: 'b',
        title: 'B',
        createdAt: '2026-03-01T00:00:00.000Z',
        watchHistory: [],
      });
      expect(compareItems(a, b, 'lastWatched', 'asc')).toBeLessThan(0);
      expect(compareItems(a, b, 'lastWatched', 'desc')).toBeGreaterThan(0);
    });

    it('compares fallback vs history correctly', () => {
      const a = item({
        id: 'a',
        title: 'A',
        createdAt: '2026-10-01T00:00:00.000Z',
        watchHistory: [],
      });
      const b = item({
        id: 'b',
        title: 'B',
        createdAt: '2026-01-01T00:00:00.000Z',
        watchHistory: [{ date: '2026-02-01T00:00:00.000Z' }],
      });
      // a lastWatched = 2026-10-01, b = 2026-02-01
      expect(compareItems(a, b, 'lastWatched', 'asc')).toBeGreaterThan(0);
    });
  });

  describe('sortItems', () => {
    it('returns a new array without mutating original', () => {
      const items = [item({ id: 'b', title: 'B' }), item({ id: 'a', title: 'A' })];
      const sorted = sortItems(items, 'title', 'asc');
      expect(sorted.map((i) => i.id)).toEqual(['a', 'b']);
      expect(items.map((i) => i.id)).toEqual(['b', 'a']);
    });

    it('sorts by title ascending', () => {
      const items = [
        item({ id: 'c', title: 'Cherry' }),
        item({ id: 'a', title: 'apple' }),
        item({ id: 'b', title: 'Banana' }),
      ];
      expect(sortItems(items, 'title', 'asc').map((i) => i.id)).toEqual(['a', 'b', 'c']);
    });

    it('sorts by title descending', () => {
      const items = [
        item({ id: 'a', title: 'Apple' }),
        item({ id: 'b', title: 'Banana' }),
        item({ id: 'c', title: 'Cherry' }),
      ];
      expect(sortItems(items, 'title', 'desc').map((i) => i.id)).toEqual(['c', 'b', 'a']);
    });

    it('sorts by createdAt ascending', () => {
      const items = [
        item({ id: 'b', title: 'B', createdAt: '2026-02-01T00:00:00.000Z' }),
        item({ id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00.000Z' }),
        item({ id: 'c', title: 'C', createdAt: '2026-03-01T00:00:00.000Z' }),
      ];
      expect(sortItems(items, 'createdAt', 'asc').map((i) => i.id)).toEqual(['a', 'b', 'c']);
    });

    it('sorts by createdAt descending (default)', () => {
      const items = [
        item({ id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00.000Z' }),
        item({ id: 'b', title: 'B', createdAt: '2026-03-01T00:00:00.000Z' }),
        item({ id: 'c', title: 'C', createdAt: '2026-02-01T00:00:00.000Z' }),
      ];
      expect(sortItems(items, 'createdAt', 'desc').map((i) => i.id)).toEqual(['b', 'c', 'a']);
    });

    it('sorts by lastWatched ascending', () => {
      const items = [
        item({
          id: 'b',
          title: 'B',
          watchHistory: [{ date: '2026-05-01T00:00:00.000Z' }],
        }),
        item({
          id: 'a',
          title: 'A',
          watchHistory: [{ date: '2026-01-01T00:00:00.000Z' }],
        }),
        item({
          id: 'c',
          title: 'C',
          watchHistory: [{ date: '2026-03-01T00:00:00.000Z' }],
        }),
      ];
      expect(sortItems(items, 'lastWatched', 'asc').map((i) => i.id)).toEqual(['a', 'c', 'b']);
    });

    it('sorts by lastWatched descending', () => {
      const items = [
        item({
          id: 'a',
          title: 'A',
          watchHistory: [{ date: '2026-01-01T00:00:00.000Z' }],
        }),
        item({
          id: 'b',
          title: 'B',
          watchHistory: [{ date: '2026-05-01T00:00:00.000Z' }],
        }),
        item({
          id: 'c',
          title: 'C',
          watchHistory: [{ date: '2026-03-01T00:00:00.000Z' }],
        }),
      ];
      expect(sortItems(items, 'lastWatched', 'desc').map((i) => i.id)).toEqual(['b', 'c', 'a']);
    });

    it('handles empty array', () => {
      expect(sortItems([], 'title', 'asc')).toEqual([]);
    });

    it('handles single item', () => {
      const single = [item({ id: 'a', title: 'A' })];
      expect(sortItems(single, 'title', 'asc').map((i) => i.id)).toEqual(['a']);
    });
  });
});
