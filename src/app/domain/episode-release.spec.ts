import { Item, SeasonInfo } from '../models/item.model';
import {
  canSnoozeCurrentSeason,
  getCurrentEpisodeAirDate,
  getEpisodeAirDate,
} from './episode-release';

describe('episode release estimates', () => {
  const season = { seasonNumber: 1, firstEpisodeAirDate: '2026-10-01' };

  it('adds accumulated delay to pending and subsequent episodes, with absent count meaning zero', () => {
    expect(getEpisodeAirDate(season, 3)).toEqual(new Date(2026, 9, 15));
    expect(getEpisodeAirDate({ ...season, snoozeCount: 1 }, 3)).toEqual(new Date(2026, 9, 22));
    expect(getEpisodeAirDate({ ...season, snoozeCount: 2 }, 3)).toEqual(new Date(2026, 9, 29));
    expect(getEpisodeAirDate({ ...season, snoozeCount: 2 }, 4)).toEqual(new Date(2026, 10, 5));
    expect(getEpisodeAirDate(season, 0)).toEqual(new Date(2026, 9, 1));
  });

  it.each([
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '2026-01-00',
    'bad',
    '2026-1-01',
  ])('rejects unusable baseline %s without date rollover', (firstEpisodeAirDate) => {
    expect(getEpisodeAirDate({ ...season, firstEpisodeAirDate }, 1)).toBeNull();
  });

  it('accepts leap days and interprets years below 100 literally', () => {
    expect(getEpisodeAirDate({ ...season, firstEpisodeAirDate: '2024-02-29' }, 1)).toEqual(
      new Date(2024, 1, 29),
    );
    expect(
      getEpisodeAirDate({ ...season, firstEpisodeAirDate: '0001-01-01' }, 1)?.getFullYear(),
    ).toBe(1);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1e12])(
    'rejects invalid or unrepresentable delay %s',
    (snoozeCount) => {
      expect(getEpisodeAirDate({ ...season, snoozeCount }, 1)).toBeNull();
    },
  );

  it('keeps estimates at local midnight across spring and autumn daylight-saving boundaries', () => {
    for (const [firstEpisodeAirDate, expected] of [
      ['2026-03-01', new Date(2026, 2, 15)],
      ['2026-10-25', new Date(2026, 10, 8)],
    ] as const) {
      const estimate = getEpisodeAirDate({ ...season, firstEpisodeAirDate, snoozeCount: 1 }, 2);
      expect(estimate).toEqual(expected);
      expect(estimate?.getHours()).toBe(0);
    }
  });

  it('selects only the current season delay and suspends it when the baseline is cleared', () => {
    const item: Item = {
      id: 'series',
      title: 'Series',
      type: 'series',
      groupId: 'ungrouped',
      status: 'in-progress',
      isAdult: false,
      createdAt: '2026-01-01',
      watchHistory: [],
      progress: {
        season: 2,
        episode: 1,
        seasons: [
          { ...season, snoozeCount: 5 },
          { seasonNumber: 2, firstEpisodeAirDate: '2027-01-07' },
        ],
      },
    };
    expect(getCurrentEpisodeAirDate(item)).toEqual(new Date(2027, 0, 7));
    const current = item.progress!.seasons[1];
    current.snoozeCount = 2;
    expect(getCurrentEpisodeAirDate(item)).toEqual(new Date(2027, 0, 21));
    current.firstEpisodeAirDate = undefined;
    expect(getCurrentEpisodeAirDate(item)).toBeNull();
    expect(canSnoozeCurrentSeason(item)).toBe(false);
    current.firstEpisodeAirDate = '2027-01-07';
    expect(getCurrentEpisodeAirDate(item)).toEqual(new Date(2027, 0, 21));
    item.progress!.season = 1;
    expect(getCurrentEpisodeAirDate(item)).toEqual(new Date(2026, 10, 5));
  });

  it('does not offer an increment that exceeds date or safe-integer limits', () => {
    const item: Item = {
      id: 'series',
      title: 'Series',
      type: 'series',
      groupId: 'ungrouped',
      status: 'in-progress',
      isAdult: false,
      createdAt: '2026-01-01',
      watchHistory: [],
      progress: {
        season: 1,
        episode: 1,
        seasons: [{ ...season, snoozeCount: Number.MAX_SAFE_INTEGER }],
      },
    };
    expect(canSnoozeCurrentSeason(item)).toBe(false);
    const metadata: SeasonInfo = { ...season, snoozeCount: -1 };
    item.progress!.seasons = [metadata];
    expect(canSnoozeCurrentSeason(item)).toBe(false);
  });
});
