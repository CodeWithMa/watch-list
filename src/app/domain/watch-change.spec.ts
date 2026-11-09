import { Item } from '../models/item.model';
import { describeWatchChange, recordWatchChange, revertWatchChange } from './watch-change';

function series(overrides: Partial<Item> = {}): Item {
  return {
    id: 'series',
    title: 'Severance',
    type: 'series',
    groupId: 'ungrouped',
    status: 'in-progress',
    isAdult: false,
    watchHistory: [],
    createdAt: '2026-01-01',
    progress: { season: 1, episode: 2, seasons: [{ seasonNumber: 1, totalEpisodes: 9 }] },
    ...overrides,
  };
}

describe('describeWatchChange', () => {
  const logEpisode = (item: Item) => {
    item.watchHistory.push({ date: '2026-01-02', season: 1, episode: 2 });
    item.progress!.episode = 3;
  };

  it.each<[string, (item: Item) => void, Partial<Item>, string | null]>([
    ['a logged episode', logEpisode, {}, 'Severance: S1 E2 logged'],
    [
      'a finished title',
      (item) => {
        logEpisode(item);
        item.status = 'completed';
      },
      {},
      'Severance: S1 E2 logged — title completed',
    ],
    [
      'a watched movie',
      (item) => {
        item.status = 'completed';
        item.watchHistory.push({ date: '2026-01-02' });
      },
      { type: 'movie', progress: undefined },
      'Severance marked as watched',
    ],
    ['a pause', (item) => (item.status = 'paused'), {}, 'Severance paused'],
    ['a drop', (item) => (item.status = 'dropped'), {}, 'Severance dropped — watch history kept'],
    [
      'a resume',
      (item) => (item.status = 'in-progress'),
      { status: 'paused' },
      'Severance resumed',
    ],
    [
      'a start',
      (item) => (item.status = 'in-progress'),
      { status: 'not-started' },
      'Severance moved to currently watching',
    ],
    ['nothing', () => undefined, {}, null],
  ])('acknowledges %s', (_name, command, overrides, message) => {
    expect(describeWatchChange(recordWatchChange(series(overrides), command))).toBe(message);
  });

  it('acknowledges a deferral with its episode and clearing it', () => {
    const until = new Date('2026-01-03T10:00:00').toISOString();
    const deferred = recordWatchChange(series(), (item) => {
      item.availabilityDeferral = { season: 1, episode: 2, until };
    });
    expect(describeWatchChange(deferred)).toContain('Severance: S1 E2 hidden until');
    const cleared = recordWatchChange(
      series({ availabilityDeferral: { season: 1, episode: 2, until } }),
      (item) => delete item.availabilityDeferral,
    );
    expect(describeWatchChange(cleared)).toBe('Severance: availability deferral cleared');
  });
});

describe('revertWatchChange', () => {
  it('restores history, progress, status, and deferral but keeps later title edits', () => {
    const availabilityDeferral = { season: 1, episode: 2, until: '2026-01-03T10:00:00.000Z' };
    const item = series({ availabilityDeferral });
    const original = structuredClone(item);
    const change = recordWatchChange(item, (current) => {
      current.watchHistory.push({ date: '2026-01-02', season: 1, episode: 2 });
      current.progress!.episode = 3;
      delete current.availabilityDeferral;
    });
    item.title = 'Renamed';

    expect(revertWatchChange(item, change)).toBe(true);
    expect(item).toEqual({ ...original, title: 'Renamed' });
  });

  it('ignores stored key order when checking for later changes', () => {
    const item = series();
    const change = recordWatchChange(item, (current) => (current.status = 'paused'));
    const { season, episode, seasons } = item.progress!;
    item.progress = { seasons, episode, season };
    expect(revertWatchChange(item, change)).toBe(true);
  });

  it('refuses to overwrite a later watch-state change', () => {
    const item = series();
    const change = recordWatchChange(item, (current) => (current.status = 'paused'));
    item.status = 'dropped';
    expect(revertWatchChange(item, change)).toBe(false);
    expect(item.status).toBe('dropped');
  });
});
