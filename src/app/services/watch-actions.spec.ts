import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { StorageService } from './storage.service';
import { WatchListService } from './watch-list.service';
import type { Item } from '../models/item.model';
import { GroupService } from './group.service';
import { RoundRobinService } from './round-robin.service';
import { controlStorageWrites } from './indexeddb-write.test-utils';

const commands = [
  'markWatched',
  'markStarted',
  'markPaused',
  'markCompleted',
  'markDropped',
  'snoozeOneWeek',
  'removeOneWeekDelay',
] as const;

describe('Settled watch actions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('awaits rapid watched commands, retains every episode, and survives reload', async () => {
    const { storage, watch } = await setup();
    const results = await Promise.all([watch.markWatched('series'), watch.markWatched('series')]);
    expect(results).toEqual([
      { value: undefined, durability: 'persistent' },
      { value: undefined, durability: 'persistent' },
    ]);
    expect(watch.getItemById('series')).toMatchObject({
      status: 'in-progress',
      progress: { season: 3, episode: 2 },
      watchHistory: [
        { season: 1, episode: 2 },
        { season: 3, episode: 1 },
      ],
    });
    const reloaded = TestBed.runInInjectionContext(() => new StorageService());
    await reloaded.initialize();
    expect(reloaded.getData()).toEqual(storage.getData());
  });

  it.each(commands)(
    '%s publishes and resolves only after transaction completion',
    async (command) => {
      const { storage, watch } = await setup();
      if (command === 'markStarted') await watch.markPaused('series');
      const original = watch.getItemById('series');
      let resolved = false;
      let beforeCommit: unknown;
      controlStorageWrites([], () => {
        beforeCommit = { resolved, item: watch.getItemById('series') };
      });
      const result = await watch[command]('series').then((result) => {
        resolved = true;
        return result;
      });
      expect(beforeCommit).toEqual({ resolved: false, item: original });
      expect(result).toEqual({ value: undefined, durability: 'persistent' });
      const expectedStatus = {
        markWatched: 'in-progress',
        markStarted: 'in-progress',
        markPaused: 'paused',
        markCompleted: 'completed',
        markDropped: 'dropped',
        snoozeOneWeek: 'in-progress',
        removeOneWeekDelay: 'in-progress',
      }[command];
      expect(watch.getItemById('series')).toMatchObject({
        status: expectedStatus,
        progress: {
          season: command === 'markWatched' ? 3 : 1,
          episode: command === 'markWatched' ? 1 : 2,
          seasons: [
            {
              seasonNumber: 1,
              snoozeCount:
                command === 'snoozeOneWeek' ? 2 : command === 'removeOneWeekDelay' ? 0 : 1,
            },
            { seasonNumber: 3, snoozeCount: 1 },
          ],
        },
        watchHistory: command === 'markWatched' ? [{ season: 1, episode: 2 }] : [],
      });
      await expectReload(storage);
    },
  );

  describe.each(commands)('failed %s', (command) => {
    it.each(['watched', 'delay', 'group'] as const)(
      'cannot leak into a later successful %s command',
      async (next) => {
        const { storage, watch } = await setup();
        if (command === 'markStarted') await watch.markPaused('series');
        const original = watch.getItemById('series')!;
        abortWrites([false]);
        const failed = watch[command]('series');
        const following =
          next === 'watched'
            ? watch.markWatched('series')
            : next === 'delay'
              ? watch.snoozeOneWeek('series')
              : TestBed.inject(GroupService).createGroup('Later');
        const results = await Promise.allSettled([failed, following]);
        expect(results.map((result) => result.status)).toEqual(['rejected', 'fulfilled']);
        expect(watch.getItemById('series')).toMatchObject({
          status: next === 'watched' ? 'in-progress' : original.status,
          progress: {
            season: next === 'watched' ? 3 : 1,
            episode: next === 'watched' ? 1 : 2,
            seasons: [
              { snoozeCount: next === 'delay' && original.status === 'in-progress' ? 2 : 1 },
              { snoozeCount: 1 },
            ],
          },
          watchHistory: next === 'watched' ? [{ season: 1, episode: 2 }] : [],
        });
        if (next === 'group')
          expect(storage.getGroups().map((group) => group.name)).toEqual(['Ungrouped', 'Later']);
        await expectReload(storage);
      },
    );
  });

  describe.each(['markWatched', 'markPaused', 'snoozeOneWeek'] as const)(
    '%s followed by watched',
    (first) => {
      it.each([
        [false, false],
        [false, true],
        [true, false],
        [true, true],
      ])('retains only successful intents (%s, %s)', async (firstSucceeds, secondSucceeds) => {
        const { storage, watch } = await setup();
        abortWrites([firstSucceeds, secondSucceeds]);
        const results = await Promise.allSettled([
          watch[first]('series'),
          watch.markWatched('series'),
        ]);
        expect(results.map((result) => result.status)).toEqual([
          firstSucceeds ? 'fulfilled' : 'rejected',
          secondSucceeds ? 'fulfilled' : 'rejected',
        ]);
        const watches =
          (first === 'markWatched' && firstSucceeds ? 1 : 0) + (secondSucceeds ? 1 : 0);
        expect(watch.getItemById('series')).toMatchObject({
          status: secondSucceeds
            ? 'in-progress'
            : first === 'markPaused' && firstSucceeds
              ? 'paused'
              : 'in-progress',
          progress: {
            season: watches ? 3 : 1,
            episode: watches === 2 ? 2 : watches === 1 ? 1 : 2,
            seasons: [
              { snoozeCount: first === 'snoozeOneWeek' && firstSucceeds ? 2 : 1 },
              { snoozeCount: 1 },
            ],
          },
          watchHistory:
            watches === 2
              ? [
                  { season: 1, episode: 2 },
                  { season: 3, episode: 1 },
                ]
              : watches === 1
                ? [{ season: 1, episode: 2 }]
                : [],
        });
        await expectReload(storage);
      });
    },
  );

  it('sequences mixed status, watch, delay and group commands using the current season', async () => {
    const { storage, watch } = await setup();
    const groups = TestBed.inject(GroupService);
    await Promise.all([
      watch.snoozeOneWeek('series'),
      watch.markWatched('series'),
      watch.snoozeOneWeek('series'),
      watch.markPaused('series'),
      groups.createGroup('Later'),
      watch.markStarted('series'),
      watch.markWatched('series'),
      watch.markWatched('series'),
    ]);
    expect(watch.getItemById('series')).toMatchObject({
      status: 'completed',
      progress: { season: 3, episode: 2, seasons: [{ snoozeCount: 2 }, { snoozeCount: 2 }] },
      watchHistory: [
        { season: 1, episode: 2 },
        { season: 3, episode: 1 },
        { season: 3, episode: 2 },
      ],
    });
    expect(storage.getGroups().map((group) => group.name)).toEqual(['Ungrouped', 'Later']);
    await expectReload(storage);
  });

  it('changes recommendations only on commit and retains them after reload', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 18));
    const { storage, watch } = await setup();
    const recommendations = TestBed.inject(RoundRobinService);
    expect(recommendations.nextSeries()?.id).toBe('series');
    abortWrites([false]);
    await expect(watch.snoozeOneWeek('series')).rejects.toThrow();
    expect(recommendations.nextSeries()?.id).toBe('series');
    await watch.snoozeOneWeek('series');
    expect(recommendations.nextSeries()).toBeNull();
    await expectReload(storage);
    TestBed.resetTestingModule();
    await TestBed.inject(StorageService).initialize();
    expect(TestBed.inject(RoundRobinService).nextSeries()).toBeNull();
    await TestBed.inject(WatchListService).removeOneWeekDelay('series');
    expect(TestBed.inject(RoundRobinService).nextSeries()?.id).toBe('series');
  });

  it('treats inherited object names as missing items without changing the collection', async () => {
    const { storage, watch } = await setup();
    const original = storage.getData().items;
    for (const command of commands) await watch[command]('toString');
    expect(storage.getData().items).toEqual(original);
  });

  describe.each([false, true])('group deletion first: %s', (groupFirst) => {
    it.each([
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ])(
      'retains settled watch and group outcomes (%s, %s)',
      async (groupSucceeds, watchedSucceeds) => {
        const { storage, watch } = await setup();
        const original = storage.getData();
        await storage.saveData({
          ...original,
          groups: { ...original.groups, films: { id: 'films', name: 'Films', order: 1 } },
          items: { series: { ...original.items['series'], groupId: 'films' } },
        });
        abortWrites(
          groupFirst ? [groupSucceeds, watchedSucceeds] : [watchedSucceeds, groupSucceeds],
        );
        const groups = TestBed.inject(GroupService);
        const results = await Promise.allSettled(
          groupFirst
            ? [groups.deleteGroup('films'), watch.markWatched('series')]
            : [watch.markWatched('series'), groups.deleteGroup('films')],
        );
        expect(results.map((result) => result.status)).toEqual(
          (groupFirst ? [groupSucceeds, watchedSucceeds] : [watchedSucceeds, groupSucceeds]).map(
            (success) => (success ? 'fulfilled' : 'rejected'),
          ),
        );
        expect(storage.getGroups().map((group) => group.id)).toEqual(
          groupSucceeds ? ['ungrouped'] : ['ungrouped', 'films'],
        );
        expect(watch.getItemById('series')).toMatchObject({
          groupId: groupSucceeds ? 'ungrouped' : 'films',
          progress: { season: watchedSucceeds ? 3 : 1, episode: watchedSucceeds ? 1 : 2 },
          watchHistory: watchedSucceeds ? [{ season: 1, episode: 2 }] : [],
        });
        await expectReload(storage);
      },
    );
  });

  it('retains movie history through pause, restart, drop and completion', async () => {
    const { storage, watch } = await setup();
    const previous = { date: '2026-01-01T10:00:00Z' };
    const data = storage.getData();
    await storage.saveData({
      ...data,
      items: {
        movie: {
          ...data.items['series'],
          id: 'movie',
          type: 'movie',
          progress: undefined,
          watchHistory: [previous],
          status: 'not-started',
        },
      },
    });
    await Promise.all([
      watch.markStarted('movie'),
      watch.markPaused('movie'),
      watch.markStarted('movie'),
      watch.markWatched('movie'),
      watch.markDropped('movie'),
      watch.markCompleted('movie'),
    ]);
    const movie = watch.getItemById('movie')!;
    expect(movie.status).toBe('completed');
    expect(movie.progress).toBeUndefined();
    expect(movie.watchHistory).toHaveLength(2);
    expect(movie.watchHistory[0]).toEqual(previous);
    expect(movie.watchHistory[1].date).toBeDefined();
    await expectReload(storage);
  });

  describe.each(['markWatched', 'markPaused', 'snoozeOneWeek'] as const)(
    '%s with settled item saves',
    (command) => {
      describe.each(['add', 'update', 'delete'] as const)('%s unrelated item', (itemAction) => {
        it.each([true, false])(
          'preserves committed watch changes (overlap: %s)',
          async (overlap) => {
            const { storage, watch } = await setup();
            const original = storage.getData();
            const other: Item = {
              ...original.items['series'],
              id: 'other',
              title: 'Other',
              type: 'movie',
              progress: undefined,
            };
            await storage.saveData({ ...original, items: { ...original.items, other } });
            const saveItem = () =>
              itemAction === 'add'
                ? watch.addItem({
                    title: 'Added',
                    type: 'movie',
                    status: 'not-started',
                    groupId: 'ungrouped',
                    isAdult: false,
                  })
                : itemAction === 'update'
                  ? watch.updateItem(other.id, { title: 'Edited' })
                  : watch.deleteItem('other');
            let itemWrite: ReturnType<typeof saveItem> | undefined;
            if (overlap)
              controlStorageWrites([], (index) => {
                if (index === 0) itemWrite = saveItem();
              });
            await watch[command]('series');
            if (!overlap) itemWrite = saveItem();
            expect(itemWrite).toBeDefined();
            await itemWrite;
            expect(watch.getItemById('series')).toMatchObject({
              status: command === 'markPaused' ? 'paused' : 'in-progress',
              progress: {
                season: command === 'markWatched' ? 3 : 1,
                episode: command === 'markWatched' ? 1 : 2,
                seasons: [{ snoozeCount: command === 'snoozeOneWeek' ? 2 : 1 }, { snoozeCount: 1 }],
              },
              watchHistory: command === 'markWatched' ? [{ season: 1, episode: 2 }] : [],
            });
            expect(watch.getItemById('other')?.title).toBe(
              itemAction === 'delete' ? undefined : itemAction === 'update' ? 'Edited' : 'Other',
            );
            expect(watch.items().some((item) => item.title === 'Added')).toBe(itemAction === 'add');
            await expectReload(storage);
          },
        );
      });
    },
  );

  describe.each(['update', 'delete'] as const)(
    'pending watched command followed by same-item %s',
    (action) => {
      it.each([
        [false, false],
        [false, true],
        [true, false],
        [true, true],
      ])(
        'retains successful progress, edits and history (%s, %s)',
        async (watchedSucceeds, itemSucceeds) => {
          const { storage, watch } = await setup();
          abortWrites([watchedSucceeds, itemSucceeds]);
          const watched = watch.markWatched('series');
          const itemWrite =
            action === 'update'
              ? watch.updateItem('series', { title: 'Edited' })
              : watch.deleteItem('series');
          const results = await Promise.allSettled([watched, itemWrite]);
          expect(results.map((result) => result.status)).toEqual([
            watchedSucceeds ? 'fulfilled' : 'rejected',
            itemSucceeds ? 'fulfilled' : 'rejected',
          ]);
          const deleted = action === 'delete' && itemSucceeds;
          if (deleted) expect(watch.getItemById('series')).toBeUndefined();
          else
            expect(watch.getItemById('series')).toMatchObject({
              title: action === 'update' && itemSucceeds ? 'Edited' : 'Series',
              progress: { season: watchedSucceeds ? 3 : 1, episode: watchedSucceeds ? 1 : 2 },
            });
          expect(watch.getAllWatchHistory()).toMatchObject(
            watchedSucceeds
              ? [
                  {
                    itemId: 'series',
                    season: 1,
                    episode: 2,
                    ...(deleted ? { isDeleted: true } : {}),
                  },
                ]
              : [],
          );
          await expectReload(storage);
        },
      );
    },
  );
});

function abortWrites(outcomes: boolean[]) {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  controlStorageWrites(outcomes);
}

async function expectReload(storage: StorageService) {
  const reloaded = TestBed.runInInjectionContext(() => new StorageService());
  await reloaded.initialize();
  expect(reloaded.getData()).toEqual(storage.getData());
}

async function setup() {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  TestBed.configureTestingModule({});
  const storage = TestBed.inject(StorageService);
  const watch = TestBed.inject(WatchListService);
  await storage.initialize();
  const series: Item = {
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
      episode: 2,
      seasons: [
        { seasonNumber: 1, totalEpisodes: 2, firstEpisodeAirDate: '2026-10-01', snoozeCount: 1 },
        { seasonNumber: 3, totalEpisodes: 2, firstEpisodeAirDate: '2027-01-01', snoozeCount: 1 },
      ],
    },
  };
  await storage.saveData({ ...storage.getData(), items: { series } });
  return { storage, watch };
}
