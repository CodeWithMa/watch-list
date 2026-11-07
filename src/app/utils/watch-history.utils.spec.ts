import { groupHistoryEntries } from './watch-history.utils';
import { HistoryEntry } from '../models/storage.model';

describe('groupHistoryEntries', () => {
  it('groups entries by day and sorts newest groups first', () => {
    const entries: HistoryEntry[] = [
      {
        itemId: '1',
        itemTitle: 'Movie',
        itemType: 'movie',
        date: '2026-04-25T09:30:00',
      },
      {
        itemId: '2',
        itemTitle: 'Series',
        itemType: 'series',
        date: '2026-04-26T08:15:00',
        season: 1,
        episode: 3,
      },
    ];

    const grouped = groupHistoryEntries(entries, 'en-US', new Date('2026-04-26T12:00:00'));

    expect(grouped).toHaveLength(2);
    expect(grouped[0].label).toBe('Today · Sun, Apr 26');
    expect(grouped[0].entries[0].relativeTime).toBe('8:15 AM');
    expect(grouped[1].label).toBe('Yesterday · Sat, Apr 25');
  });

  it('names the weekday for the past week and states each date once', () => {
    const entries: HistoryEntry[] = [
      {
        itemId: '1',
        itemTitle: 'Series',
        itemType: 'series',
        date: '2026-04-22T18:45:00',
        season: 2,
        episode: 1,
      },
      { itemId: '2', itemTitle: 'Movie', itemType: 'movie', date: '2026-03-02T21:00:00' },
    ];

    const grouped = groupHistoryEntries(entries, 'en-US', new Date('2026-04-26T12:00:00'));

    expect(grouped.map(({ label }) => label)).toEqual(['Wednesday, Apr 22', 'Mon, Mar 2']);
  });

  it('adds the year only for days outside the current year', () => {
    const entries: HistoryEntry[] = [
      { itemId: '1', itemTitle: 'Movie', itemType: 'movie', date: '2025-12-30T21:00:00' },
    ];

    const grouped = groupHistoryEntries(entries, 'en-US', new Date('2026-01-02T12:00:00'));

    expect(grouped[0].label).toBe('Tuesday, Dec 30, 2025');
  });
});
