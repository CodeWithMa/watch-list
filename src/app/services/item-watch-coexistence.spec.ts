import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { StorageService } from './storage.service';
import { WatchListService } from './watch-list.service';
import { controlStorageWrites, holdStorageWrite } from './indexeddb-write.test-utils';
import { buildItemMutationInput, createItemFormValue } from '../domain/item-form';
import type { Item } from '../models/item.model';

describe('Item edits coexisting with settled watch commands', () => {
  afterEach(() => vi.restoreAllMocks());

  describe.each(['markWatched', 'snoozeOneWeek'] as const)(
    'season metadata edit with %s',
    (command) => {
      it.each([true, false])('preserves committed progress (overlap: %s)', async (overlap) => {
        const { storage, watch } = await setup();
        let edit: Promise<void> | undefined;
        const editSeason = () => {
          const current = watch.getItemById('series')!;
          const form = createItemFormValue(current);
          form.seasons = form.seasons.map((season) => ({ ...season, totalEpisodes: 12 }));
          return watch.updateItem({ ...current, ...buildItemMutationInput(form) });
        };
        if (overlap)
          controlStorageWrites([], (index) => {
            if (index === 0) edit = editSeason();
          });
        await watch[command]('series');
        if (!overlap) edit = editSeason();
        expect(edit).toBeDefined();
        await edit;
        const reloaded = await reload();
        const expected = {
          episode: command === 'markWatched' ? 3 : 2,
          snoozeCount: command === 'snoozeOneWeek' ? 1 : 0,
          totalEpisodes: 12,
          historyLength: command === 'markWatched' ? 1 : 0,
        };
        expect({ live: summarize(storage), reloaded: summarize(reloaded) }).toEqual({
          live: expected,
          reloaded: expected,
        });
      });

      it.each([
        [false, false],
        [false, true],
        [true, false],
        [true, true],
      ])(
        'retains only successful command and metadata changes (%s, %s)',
        async (watchSucceeds, editSucceeds) => {
          const { storage, watch } = await setup();
          vi.spyOn(console, 'error').mockImplementation(() => undefined);
          controlStorageWrites([watchSucceeds, editSucceeds]);
          const action = watch[command]('series');
          const current = watch.getItemById('series')!;
          const form = createItemFormValue(current);
          form.seasons = form.seasons.map((season) => ({ ...season, totalEpisodes: 12 }));
          const edit = watch.updateItem({ ...current, ...buildItemMutationInput(form) });
          const results = await Promise.allSettled([action, edit]);
          expect(results.map((result) => result.status)).toEqual([
            watchSucceeds ? 'fulfilled' : 'rejected',
            editSucceeds ? 'fulfilled' : 'rejected',
          ]);
          const expected = {
            episode: command === 'markWatched' && watchSucceeds ? 3 : 2,
            snoozeCount: command === 'snoozeOneWeek' && watchSucceeds ? 1 : 0,
            totalEpisodes: editSucceeds ? 12 : 10,
            historyLength: command === 'markWatched' && watchSucceeds ? 1 : 0,
          };
          expect({ live: summarize(storage), reloaded: summarize(await reload()) }).toEqual({
            live: expected,
            reloaded: expected,
          });
        },
      );

      it('honors explicit changes to the same episode or delay property', async () => {
        const { storage, watch } = await setup();
        const action = watch[command]('series');
        const current = watch.getItemById('series')!;
        const form = createItemFormValue(current);
        if (command === 'markWatched') form.episode = 8;
        else form.seasons = form.seasons.map((season) => ({ ...season, snoozeCount: 5 }));
        await Promise.all([
          action,
          watch.updateItem({ ...current, ...buildItemMutationInput(form) }),
        ]);
        const expected = {
          episode: command === 'markWatched' ? 8 : 2,
          snoozeCount: command === 'snoozeOneWeek' ? 5 : 0,
          totalEpisodes: 10,
          historyLength: command === 'markWatched' ? 1 : 0,
        };
        expect({ live: summarize(storage), reloaded: summarize(await reload()) }).toEqual({
          live: expected,
          reloaded: expected,
        });
      });
    },
  );

  it('rebases season fields by season number when the form reorders, adds and removes seasons', async () => {
    const { storage, watch } = await setup();
    const original = watch.getItemById('series')!;
    await watch.updateItem({
      ...original,
      progress: {
        season: 3,
        episode: 2,
        seasons: [
          { seasonNumber: 3, totalEpisodes: 10, firstEpisodeAirDate: '2026-01-01', snoozeCount: 2 },
          { seasonNumber: 2, totalEpisodes: 4, snoozeCount: 4 },
          { seasonNumber: 1, totalEpisodes: 8, snoozeCount: 0 },
        ],
      },
    });
    const action = watch.snoozeOneWeek('series');
    const current = watch.getItemById('series')!;
    const form = createItemFormValue(current);
    form.seasons = [
      ...form.seasons
        .filter((season) => season.seasonNumber !== 2)
        .map((season) => (season.seasonNumber === 1 ? { ...season, totalEpisodes: 12 } : season)),
      { seasonNumber: 5, totalEpisodes: 6, snoozeCount: 1 },
    ];
    await Promise.all([action, watch.updateItem({ ...current, ...buildItemMutationInput(form) })]);
    const expected = {
      season: 3,
      episode: 2,
      seasons: [
        { seasonNumber: 1, totalEpisodes: 12, snoozeCount: 0 },
        { seasonNumber: 3, totalEpisodes: 10, firstEpisodeAirDate: '2026-01-01', snoozeCount: 3 },
        { seasonNumber: 5, totalEpisodes: 6, snoozeCount: 1 },
      ],
    };
    expect(watch.getItemById('series')?.progress).toEqual(expected);
    expect((await reload()).getData()).toEqual(storage.getData());
  });

  it('retains delay when a concurrent edit clears the release baseline', async () => {
    const { storage, watch } = await setup();
    const action = watch.snoozeOneWeek('series');
    const current = watch.getItemById('series')!;
    const form = createItemFormValue(current);
    form.seasons = form.seasons.map((season) => ({ ...season, firstEpisodeAirDate: undefined }));
    await Promise.all([action, watch.updateItem({ ...current, ...buildItemMutationInput(form) })]);
    expect(watch.getItemById('series')?.progress?.seasons[0]).toMatchObject({
      firstEpisodeAirDate: undefined,
      snoozeCount: 1,
    });
    expect((await reload()).getData()).toEqual(storage.getData());
  });

  describe.each([false, true])(
    'initially absent progress, explicit episode edit: %s',
    (explicitEpisode) => {
      it.each([false, true])(
        'retains the first watch or explicit episode (overlap: %s)',
        async (overlap) => {
          const { storage, watch } = await setup();
          await watch.updateItem({ ...watch.getItemById('series')!, progress: undefined });
          let edit: Promise<void> | undefined;
          const editMetadata = () => {
            const current = watch.getItemById('series')!;
            const form = createItemFormValue(current);
            form.seasons = [{ seasonNumber: 1, totalEpisodes: 12 }];
            if (explicitEpisode) form.episode = 8;
            return watch.updateItem({ ...current, ...buildItemMutationInput(form) });
          };
          if (overlap)
            controlStorageWrites([], (index) => {
              if (index === 0) edit = editMetadata();
            });
          await watch.markWatched('series');
          if (!overlap) edit = editMetadata();
          await edit;
          expect(watch.getItemById('series')).toMatchObject({
            progress: {
              season: 1,
              episode: explicitEpisode ? 8 : 2,
              seasons: [{ seasonNumber: 1, totalEpisodes: 12 }],
            },
            watchHistory: [{ season: 1, episode: 1 }],
          });
          expect((await reload()).getData()).toEqual(storage.getData());
        },
      );
    },
  );

  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    'edits a provisional addition only if creation succeeds (add: %s; edit write: %s)',
    async (addSucceeds, editSucceeds) => {
      const { storage, watch } = await setup();
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      controlStorageWrites([addSucceeds, editSucceeds]);
      const addition = watch.addItem({
        title: 'Original movie',
        type: 'movie',
        status: 'not-started',
        groupId: 'ungrouped',
        isAdult: false,
      });
      const provisional = watch.items().find((item) => item.title === 'Original movie')!;
      expect(provisional).toBeDefined();
      const edit = watch.updateItem({ ...provisional, title: 'Edited movie' });
      const outcomes = await Promise.allSettled([addition, edit]);
      expect(outcomes.map((outcome) => outcome.status)).toEqual([
        addSucceeds ? 'fulfilled' : 'rejected',
        addSucceeds && editSucceeds ? 'fulfilled' : 'rejected',
      ]);
      if (!addSucceeds && outcomes[1].status === 'rejected') {
        expect(outcomes[1].reason).toMatchObject({
          message: expect.stringContaining('no longer exists'),
        });
      }
      const reloaded = await reload();
      const expectedTitle = !addSucceeds
        ? undefined
        : editSucceeds
          ? 'Edited movie'
          : 'Original movie';
      expect({
        live: storage.getData().items[provisional.id]?.title,
        reloaded: reloaded.getData().items[provisional.id]?.title,
      }).toEqual({ live: expectedTitle, reloaded: expectedTitle });
    },
  );

  it('rejects an edit submitted after its item has been deleted', async () => {
    const { storage, watch } = await setup();
    const stale = watch.getItemById('series')!;
    await watch.deleteItem('series');
    await expect(watch.updateItem({ ...stale, title: 'Recreated' })).rejects.toThrow(
      'no longer exists',
    );
    expect(storage.getItems()).toEqual([]);
    expect((await reload()).getItems()).toEqual([]);
  });

  describe.each(['markWatched', 'snoozeOneWeek'] as const)(
    'settlement visibility for %s',
    (command) => {
      it.each([true, false])(
        'publishes before a later edit settles (overlap: %s)',
        async (overlap) => {
          const { storage, watch } = await setup();
          let edit: Promise<void> | undefined;
          let editSettled = false;
          const editTitle = () => {
            const write = watch.updateItem({
              ...watch.getItemById('series')!,
              title: 'Edited title',
            });
            void write.then(() => {
              editSettled = true;
            });
            return write;
          };
          const held = holdStorageWrite(1, (index) => {
            if (index === 0 && overlap) edit = editTitle();
          });
          const outcome = await watch[command]('series');
          const immediatelyAfterCommand = summarize(storage);
          if (!overlap) edit = editTitle();
          await held.started;
          const whileEditIsPending = {
            editSettled,
            visible: summarize(storage),
            title: watch.getItemById('series')?.title,
          };
          held.release();
          await edit;
          const reloaded = await reload();
          const expected = {
            episode: command === 'markWatched' ? 3 : 2,
            snoozeCount: command === 'snoozeOneWeek' ? 1 : 0,
            totalEpisodes: 10,
            historyLength: command === 'markWatched' ? 1 : 0,
          };
          expect(outcome).toEqual({ value: undefined, durability: 'persistent' });
          expect({ eventual: summarize(storage), reloaded: summarize(reloaded) }).toEqual({
            eventual: expected,
            reloaded: expected,
          });
          expect({ immediatelyAfterCommand, whileEditIsPending }).toEqual({
            immediatelyAfterCommand: expected,
            whileEditIsPending: { editSettled: false, visible: expected, title: 'Edited title' },
          });
        },
      );
    },
  );
});

function summarize(storage: StorageService) {
  const item = storage.getData().items['series'];
  return {
    episode: item.progress?.episode,
    snoozeCount: item.progress?.seasons[0].snoozeCount,
    totalEpisodes: item.progress?.seasons[0].totalEpisodes,
    historyLength: item.watchHistory.length,
  };
}

async function reload() {
  const storage = TestBed.runInInjectionContext(() => new StorageService());
  await storage.initialize();
  return storage;
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
    status: 'in-progress',
    groupId: 'ungrouped',
    isAdult: false,
    createdAt: '2026-01-01',
    watchHistory: [],
    progress: {
      season: 1,
      episode: 2,
      seasons: [
        { seasonNumber: 1, totalEpisodes: 10, firstEpisodeAirDate: '2026-01-01', snoozeCount: 0 },
      ],
    },
  };
  await storage.saveData({ ...storage.getData(), items: { series } });
  return { storage, watch };
}
