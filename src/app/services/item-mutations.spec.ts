import { TestBed } from '@angular/core/testing';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { StorageService } from './storage.service';
import { WatchListService } from './watch-list.service';
import { controlStorageWrites, holdStorageWrite } from './indexeddb-write.test-utils';
import { buildItemEditInput, createItemFormValue } from '../domain/item-form';
import { GroupService } from './group.service';
import { ItemMutationInput } from '../domain/item-form';
import { ImageStorageService } from './image-storage.service';

describe('Settled item mutations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('publishes an addition only after transaction completion and returns its durable identity', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    TestBed.configureTestingModule({});
    const storage = TestBed.inject(StorageService);
    const watch = TestBed.inject(WatchListService);
    await storage.initialize();
    const held = holdStorageWrite(0);
    let settled = false;
    const addition = watch
      .addItem({
        title: 'New movie',
        type: 'movie',
        status: 'not-started',
        groupId: 'ungrouped',
        isAdult: false,
      })
      .then((result) => {
        settled = true;
        return result;
      });
    try {
      await held.started;
      expect(settled).toBe(false);
      expect(watch.items()).toEqual([]);
    } finally {
      held.release();
    }
    const result = await addition;
    expect(result).toMatchObject({ durability: 'persistent', value: { title: 'New movie' } });
    const reloaded = TestBed.runInInjectionContext(() => new StorageService());
    await reloaded.initialize();
    expect(reloaded.getItems()).toEqual(watch.items());
  });

  it('applies only fields edited since form opening, retaining intervening watched progress and history', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    const storage = TestBed.inject(StorageService);
    const watch = TestBed.inject(WatchListService);
    await storage.initialize();
    const { value: added } = await watch.addItem({
      title: 'Series',
      type: 'series',
      status: 'not-started',
      groupId: 'ungrouped',
      isAdult: false,
      progress: { season: 1, episode: 1, seasons: [{ seasonNumber: 1, totalEpisodes: 10 }] },
    });
    const initial = createItemFormValue(added);
    const submitted = {
      ...initial,
      title: 'Edited',
      seasons: [{ seasonNumber: 1, totalEpisodes: 12 }],
    };
    await watch.markWatched(added.id);
    const edit = watch.updateItem(added.id, buildItemEditInput(initial, submitted));
    await edit;
    expect(watch.getItemById(added.id)).toMatchObject({
      title: 'Edited',
      status: 'in-progress',
      progress: { season: 1, episode: 2, seasons: [{ seasonNumber: 1, totalEpisodes: 12 }] },
      watchHistory: [{ season: 1, episode: 1 }],
    });
    const reloaded = TestBed.runInInjectionContext(() => new StorageService());
    await reloaded.initialize();
    expect(reloaded.getData()).toEqual(storage.getData());
  });

  it.each(['update', 'delete'] as const)(
    'publishes %s only after transaction completion',
    async (command) => {
      const { storage, watch, item } = await setup();
      const original = storage.getData();
      const held = holdStorageWrite(0);
      let settled = false;
      const operation = (
        command === 'update'
          ? watch.updateItem(item.id, { title: 'Updated' })
          : watch.deleteItem(item.id)
      ).then((result) => {
        settled = true;
        return result;
      });
      try {
        await held.started;
        expect(settled).toBe(false);
        expect(storage.getData()).toEqual(original);
      } finally {
        held.release();
      }
      expect(await operation).toEqual({ value: undefined, durability: 'persistent' });
      expect(watch.getItemById(item.id)?.title).toBe(command === 'update' ? 'Updated' : undefined);
      await expectReload(storage);
    },
  );

  it.each(['add', 'update', 'delete'] as const)(
    'discards a rejected %s before a different command succeeds, then allows retry',
    async (command) => {
      const { storage, watch, item } = await setup();
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      controlStorageWrites([false]);
      const run = () =>
        command === 'add'
          ? watch.addItem({ ...movie, title: 'Added' })
          : command === 'update'
            ? watch.updateItem(item.id, { title: 'Updated' })
            : watch.deleteItem(item.id);
      const rejected = run();
      const watched = watch.markWatched(item.id);
      expect(
        (await Promise.allSettled([rejected, watched])).map((result) => result.status),
      ).toEqual(['rejected', 'fulfilled']);
      expect(watch.items()).toHaveLength(1);
      expect(watch.getItemById(item.id)).toMatchObject({
        title: 'Series',
        progress: { episode: 2 },
        watchHistory: [{ episode: 1 }],
      });
      expect(storage.getData().deletedItems).toEqual({});
      await expectReload(storage);
      await run();
      expect(watch.getItemById(item.id)?.title).toBe(
        command === 'delete' ? undefined : command === 'update' ? 'Updated' : 'Series',
      );
      expect(watch.items()).toHaveLength(command === 'add' ? 2 : command === 'delete' ? 0 : 1);
      if (command === 'delete')
        expect(storage.getData().deletedItems?.[item.id].watchHistory).toMatchObject([
          { episode: 1 },
        ]);
      await expectReload(storage);
    },
  );

  it.each([false, true])(
    'rejects editing a missing item, including a queued deletion (overlap: %s)',
    async (overlap) => {
      const { storage, watch, item } = await setup();
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const deletion = watch.deleteItem(item.id);
      if (!overlap) await deletion;
      const edit = watch.updateItem(item.id, { title: 'Recreated' });
      await expect(edit).rejects.toThrow('no longer exists');
      await deletion;
      expect(watch.items()).toEqual([]);
      expect(storage.getData().deletedItems?.[item.id].itemTitle).toBe('Series');
      await expectReload(storage);
    },
  );

  it.each([false, true])(
    'repairs a selected group removed before save (creating: %s)',
    async (creating) => {
      const { storage, watch, item } = await setup();
      const groups = TestBed.inject(GroupService);
      const group = (await groups.createGroup('Temporary')).value;
      const deletion = groups.deleteGroup(group.id);
      await (creating
        ? watch.addItem({ ...movie, groupId: group.id })
        : watch.updateItem(item.id, { groupId: group.id }));
      await deletion;
      expect(watch.items().every((item) => item.groupId === 'ungrouped')).toBe(true);
      await expectReload(storage);
    },
  );

  it('retains intervening group reassignment and delay when editing season metadata from an old form', async () => {
    const { storage, watch, item } = await setup();
    const groups = TestBed.inject(GroupService);
    const group = (await groups.createGroup('Old group')).value;
    await watch.updateItem(item.id, { groupId: group.id, status: 'in-progress' });
    const initial = createItemFormValue(watch.getItemById(item.id)!);
    const submitted = {
      ...initial,
      seasons: initial.seasons.map((s) => ({ ...s, totalEpisodes: 12 })),
    };
    await watch.snoozeOneWeek(item.id);
    await groups.deleteGroup(group.id);
    await watch.updateItem(item.id, buildItemEditInput(initial, submitted));
    expect(watch.getItemById(item.id)).toMatchObject({
      groupId: 'ungrouped',
      progress: {
        episode: 1,
        seasons: [{ totalEpisodes: 12, snoozeCount: 1 }],
      },
    });
    await expectReload(storage);
  });

  it('honors explicit position/status/type edits while retaining concurrent history and unrelated season fields', async () => {
    const { storage, watch, item } = await setup();
    const initial = createItemFormValue(item);
    const submitted = { ...initial, status: 'paused' as const, episode: 8, isAdult: true };
    await watch.markWatched(item.id);
    await watch.updateItem(item.id, buildItemEditInput(initial, submitted));
    expect(watch.getItemById(item.id)).toMatchObject({
      status: 'paused',
      isAdult: true,
      progress: { episode: 8, seasons: [{ totalEpisodes: 10 }] },
      watchHistory: [{ episode: 1 }],
    });
    const beforeConversion = createItemFormValue(watch.getItemById(item.id)!);
    await watch.updateItem(
      item.id,
      buildItemEditInput(beforeConversion, { ...beforeConversion, type: 'movie' }),
    );
    expect(watch.getItemById(item.id)?.progress).toBeUndefined();
    expect(watch.getItemById(item.id)?.watchHistory).toHaveLength(1);
    await expectReload(storage);
  });

  it('reports session-only completion for all item commands', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('Unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const watch = TestBed.inject(WatchListService);
    const addition = await watch.addItem(movie);
    expect(addition.durability).toBe('session-only');
    expect((await watch.updateItem(addition.value.id, { title: 'Session edit' })).durability).toBe(
      'session-only',
    );
    expect((await watch.deleteItem(addition.value.id)).durability).toBe('session-only');
    expect(watch.items()).toEqual([]);
  });

  it.each(['update', 'delete'] as const)(
    'does not report a committed %s as failed when later poster cleanup rejects',
    async (command) => {
      const { storage, watch, item } = await setup();
      vi.stubGlobal('createImageBitmap', async () => ({ close: vi.fn() }));
      const posterId = await TestBed.inject(ImageStorageService).storeFile(
        new Blob(['poster'], { type: 'image/png' }),
      );
      await watch.updateItem(item.id, { posterId });
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const remove = IDBObjectStore.prototype.delete;
      vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (
        this: IDBObjectStore,
        key,
      ) {
        const request = remove.call(this, key);
        if (this.name === 'images')
          request.addEventListener('success', () => this.transaction.abort());
        return request;
      });
      const result = await (command === 'update'
        ? watch.updateItem(item.id, { title: 'Saved', posterId: undefined })
        : watch.deleteItem(item.id));
      expect(result).toEqual({ value: undefined, durability: 'persistent' });
      expect(watch.getItemById(item.id)?.title).toBe(command === 'update' ? 'Saved' : undefined);
      expect(log).toHaveBeenCalledWith('Failed to remove unused poster:', expect.any(Error));
      expect(storage.getSaveErrorSignal()()).toBeNull();
      await expectReload(storage);
    },
  );
});

const movie: ItemMutationInput = {
  title: 'Movie',
  type: 'movie',
  status: 'not-started',
  groupId: 'ungrouped',
  isAdult: false,
};

async function setup() {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  const storage = TestBed.inject(StorageService);
  const watch = TestBed.inject(WatchListService);
  await storage.initialize();
  const { value: item } = await watch.addItem({
    ...movie,
    title: 'Series',
    type: 'series',
    progress: {
      season: 1,
      episode: 1,
      seasons: [{ seasonNumber: 1, totalEpisodes: 10, firstEpisodeAirDate: '2026-01-01' }],
    },
  });
  return { storage, watch, item };
}

async function expectReload(storage: StorageService) {
  const reloaded = TestBed.runInInjectionContext(() => new StorageService());
  await reloaded.initialize();
  expect(reloaded.getData()).toEqual(storage.getData());
}
