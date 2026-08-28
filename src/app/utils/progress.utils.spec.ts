import { calculateProgress, getMostRecentWatchDate } from './progress.utils';
import { Item } from '../models/item.model';

function item(overrides: Partial<Item> & Pick<Item, 'id' | 'title'>): Item {
  return {
    type: 'series',
    groupId: 'ungrouped',
    status: 'in-progress',
    watchHistory: [],
    createdAt: '2026-04-01T10:00:00.000Z',
    ...overrides,
  } as Item;
}

describe('calculateProgress', () => {
  it('returns 100 for completed movie and 0 for not completed movie', () => {
    expect(
      calculateProgress(item({ id: '1', title: 'm', type: 'movie', status: 'completed' })),
    ).toBe(100);
    expect(
      calculateProgress(item({ id: '2', title: 'm', type: 'movie', status: 'in-progress' })),
    ).toBe(0);
    expect(calculateProgress(item({ id: '3', title: 'm', type: 'movie', status: 'paused' }))).toBe(
      0,
    );
  });

  it('returns 100 for completed episodic regardless of progress', () => {
    expect(
      calculateProgress(
        item({
          id: '1',
          title: 's',
          status: 'completed',
          progress: { season: 1, episode: 2, seasons: [{ seasonNumber: 1, totalEpisodes: 10 }] },
        }),
      ),
    ).toBe(100);
  });

  it('calculates progress based on current season', () => {
    expect(
      calculateProgress(
        item({
          id: '1',
          title: 's',
          progress: { season: 1, episode: 1, seasons: [{ seasonNumber: 1, totalEpisodes: 10 }] },
        }),
      ),
    ).toBe(0);
    expect(
      calculateProgress(
        item({
          id: '1',
          title: 's',
          progress: { season: 1, episode: 6, seasons: [{ seasonNumber: 1, totalEpisodes: 10 }] },
        }),
      ),
    ).toBe(50); // (6-1)/10 =50%
    expect(
      calculateProgress(
        item({
          id: '1',
          title: 's',
          progress: { season: 1, episode: 11, seasons: [{ seasonNumber: 1, totalEpisodes: 10 }] },
        }),
      ),
    ).toBe(100);
  });

  it('returns null when no matching season or missing data', () => {
    expect(calculateProgress(item({ id: '1', title: 's' }))).toBeNull();
    expect(
      calculateProgress(
        item({
          id: '1',
          title: 's',
          progress: { season: 2, episode: 1, seasons: [{ seasonNumber: 1, totalEpisodes: 10 }] },
        }),
      ),
    ).toBeNull();
    expect(
      calculateProgress(
        item({
          id: '1',
          title: 's',
          progress: { season: 1, episode: 1, seasons: [{ seasonNumber: 1 }] },
        }),
      ),
    ).toBeNull();
    expect(
      calculateProgress(
        item({
          id: '1',
          title: 's',
          progress: { season: 1, episode: 1, seasons: [{ seasonNumber: 1, totalEpisodes: 0 }] },
        }),
      ),
    ).toBeNull();
  });

  it('handles ova/ona as episodic', () => {
    expect(
      calculateProgress(
        item({
          id: '1',
          title: 'o',
          type: 'ova',
          progress: { season: 1, episode: 2, seasons: [{ seasonNumber: 1, totalEpisodes: 4 }] },
        }),
      ),
    ).toBe(25);
  });

  it('clamps negative to 0', () => {
    expect(
      calculateProgress(
        item({
          id: '1',
          title: 's',
          progress: { season: 1, episode: 0, seasons: [{ seasonNumber: 1, totalEpisodes: 10 }] },
        }),
      ),
    ).toBe(0);
  });
});

describe('getMostRecentWatchDate', () => {
  it('returns createdAt when no watchHistory', () => {
    expect(getMostRecentWatchDate(item({ id: '1', title: 'a' }))).toBe('2026-04-01T10:00:00.000Z');
  });

  it('returns most recent watchHistory date', () => {
    const result = getMostRecentWatchDate(
      item({
        id: '1',
        title: 'a',
        watchHistory: [
          { date: '2026-04-01T10:00:00.000Z', season: 1, episode: 1 },
          { date: '2026-04-03T10:00:00.000Z', season: 1, episode: 2 },
          { date: '2026-04-02T10:00:00.000Z' },
        ],
      }),
    );
    expect(result).toBe('2026-04-03T10:00:00.000Z');
  });
});
