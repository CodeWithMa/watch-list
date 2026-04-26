import { groupHistoryEntries } from './watch-history.utils';
import { HistoryEntry } from '../models/storage.model';

describe('groupHistoryEntries', () => {
  it('groups entries by day and sorts newest groups first', () => {
    const entries: HistoryEntry[] = [
      {
        itemId: '1',
        itemTitle: 'Movie',
        itemType: 'movie',
        date: '2026-04-25T09:30:00'
      },
      {
        itemId: '2',
        itemTitle: 'Series',
        itemType: 'series',
        date: '2026-04-26T08:15:00',
        season: 1,
        episode: 3
      }
    ];

    const grouped = groupHistoryEntries(entries, 'en-US', new Date('2026-04-26T12:00:00'));

    expect(grouped).toHaveLength(2);
    expect(grouped[0].relativeLabel).toBe('Today');
    expect(grouped[0].entries[0].relativeTime).toBe('8:15 AM');
    expect(grouped[1].relativeLabel).toBe('Yesterday');
  });

  it('uses weekday labels for recent older entries', () => {
    const entries: HistoryEntry[] = [
      {
        itemId: '1',
        itemTitle: 'Series',
        itemType: 'series',
        date: '2026-04-22T18:45:00',
        season: 2,
        episode: 1
      }
    ];

    const grouped = groupHistoryEntries(entries, 'en-US', new Date('2026-04-26T12:00:00'));

    expect(grouped[0].relativeLabel).toBe('Wednesday');
    expect(grouped[0].dateLabel).toBe('Apr 22, 2026');
  });
});
