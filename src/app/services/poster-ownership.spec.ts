import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { StorageService } from './storage.service';
import { ImageStorageService } from './image-storage.service';
import { WatchListService } from './watch-list.service';
import { holdStorageWrite } from './indexeddb-write.test-utils';
import { WatchListDatabase } from './watch-list-database.service';

describe('Committed poster ownership', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects a released or missing poster instead of committing a broken reference', async () => {
    const { storage, images, watch } = await setup();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const posterId = await images.storeFile(image(), { provisional: true });
    images.discardDraft(posterId);
    await expect(watch.addItem({ ...movie, posterId })).rejects.toThrow(/poster.*available/i);
    const reloaded = TestBed.runInInjectionContext(() => new StorageService());
    await reloaded.initialize();
    expect(reloaded.getItems()).toEqual([]);
    expect(storage.getItems()).toEqual([]);
  });

  it.each(['create', 'edit'] as const)(
    'aborts the entire %s when a poster write fails, preserving the draft for retry',
    async (command) => {
      const { storage, images, watch } = await setup();
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const oldPoster = await images.storeFile(image());
      const { value: existing } = await watch.addItem({ ...movie, posterId: oldPoster });
      const previous = storage.getData();
      const posterId = await images.storeFile(image(), { provisional: true });
      const put = IDBObjectStore.prototype.put;
      const failure = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
        this: IDBObjectStore,
        value,
        key,
      ) {
        const request = put.call(this, value, key);
        if (this.name === 'images')
          request.addEventListener('success', () => this.transaction.abort());
        return request;
      });
      const save = () =>
        command === 'create'
          ? watch.addItem({ ...movie, title: 'New', posterId })
          : watch.updateItem(existing.id, { title: 'Edited', posterId });
      await expect(save()).rejects.toThrow();
      failure.mockRestore();
      const reloaded = TestBed.runInInjectionContext(() => new StorageService());
      await reloaded.initialize();
      const freshImages = TestBed.runInInjectionContext(() => new ImageStorageService());
      expect(reloaded.getData()).toEqual(previous);
      expect(storage.getData()).toEqual(previous);
      expect(await freshImages.getUrl(oldPoster)).toBe('blob:poster');
      // Resolve through a separate storage context: a pending draft is not a persisted image.
      expect(await persistentImages().getUrl(posterId)).toBeNull();
      expect(await images.getUrl(posterId)).toBe('blob:poster');
      await save();
      const committed = TestBed.runInInjectionContext(() => new StorageService());
      await committed.initialize();
      expect(committed.getItems().find((item) => item.posterId === posterId)?.title).toBe(
        command === 'create' ? 'New' : 'Edited',
      );
      expect(await persistentImages().getUrl(posterId)).toBe('blob:poster');
      expect(await persistentImages().getUrl(oldPoster)).toBe(
        command === 'create' ? 'blob:poster' : null,
      );
    },
  );

  it('captures a provisional image before an earlier write settles and its form releases it', async () => {
    const { storage, images, watch } = await setup();
    const posterId = await images.storeFile(image(), { provisional: true });
    const held = holdStorageWrite(0);
    const earlier = storage.mutate((draft) => {
      draft.groups['ungrouped'].name = 'Before save';
    });
    const addition = watch.addItem({ ...movie, posterId });
    try {
      await held.started;
      images.discardDraft(posterId);
    } finally {
      held.release();
    }
    await Promise.all([earlier, addition]);
    expect(await persistentImages().getUrl(posterId)).toBe('blob:poster');
    const reloaded = TestBed.runInInjectionContext(() => new StorageService());
    await reloaded.initialize();
    expect(reloaded.getItems()[0].posterId).toBe(posterId);
    expect(reloaded.getGroups()[0].name).toBe('Before save');
    expect(await images.getUrl(posterId)).toBe('blob:poster');
    vi.mocked(URL.revokeObjectURL).mockClear();
    images.discardDraft(posterId);
    await Promise.resolve();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('keeps a conflicted draft retryable without partially persisting its image', async () => {
    const { storage, images, watch } = await setup();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const injector = Injector.create({ providers: [StorageService, WatchListDatabase] });
    const peer = injector.get(StorageService);
    try {
      await peer.initialize();
      const posterId = await images.storeFile(image(), { provisional: true });
      await peer.mutate((draft) => {
        draft.groups['ungrouped'].name = 'Other window';
      });
      await expect(watch.addItem({ ...movie, posterId })).rejects.toThrow(/another tab or window/);
      expect(await persistentImages().getUrl(posterId)).toBeNull();
      expect(await images.getUrl(posterId)).toBe('blob:poster');
      expect(peer.getItems()).toEqual([]);
      await storage.refresh();
      await watch.addItem({ ...movie, posterId });
      const reloaded = TestBed.runInInjectionContext(() => new StorageService());
      await reloaded.initialize();
      expect(reloaded.getGroups()[0].name).toBe('Other window');
      expect(reloaded.getItems()[0].posterId).toBe(posterId);
      expect(await persistentImages().getUrl(posterId)).toBe('blob:poster');
    } finally {
      injector.get(WatchListDatabase).close();
      injector.destroy();
    }
  });

  it.each(['edit', 'delete'] as const)(
    'preserves an imported shared poster when one owner is removed by %s',
    async (command) => {
      const { storage, images, watch } = await setup();
      const posterId = await images.storeFile(new Blob(['poster'], { type: 'image/png' }));
      const { value: first } = await watch.addItem({ ...movie, posterId });
      const { value: second } = await watch.addItem({ ...movie, title: 'Second', posterId });
      // Portable imports may legitimately give multiple items the same poster identity.
      const data = storage.getData();
      await storage.importDataWithImages(data, [{ id: posterId, blob: image() }]);
      expect(await images.getUrl(posterId)).toBe('blob:poster');
      vi.mocked(URL.revokeObjectURL).mockClear();
      await (command === 'edit'
        ? watch.updateItem(first.id, { posterId: undefined })
        : watch.deleteItem(first.id));
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      const reloaded = TestBed.runInInjectionContext(() => new StorageService());
      await reloaded.initialize();
      const freshImages = TestBed.runInInjectionContext(() => new ImageStorageService());
      expect(reloaded.getData().items[second.id].posterId).toBe(posterId);
      expect(await freshImages.getUrl(posterId)).toBe('blob:poster');
      await watch.deleteItem(second.id);
      const afterDeletion = TestBed.runInInjectionContext(() => new ImageStorageService());
      expect(await afterDeletion.getUrl(posterId)).toBeNull();
    },
  );
});

const movie = {
  title: 'Movie',
  type: 'movie',
  status: 'not-started',
  groupId: 'ungrouped',
  isAdult: false,
} as const;

function image() {
  return new Blob(['poster'], { type: 'image/png' });
}

async function setup() {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  vi.stubGlobal('createImageBitmap', async () => ({ close: vi.fn() }));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:poster');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  const storage = TestBed.inject(StorageService);
  await storage.initialize();
  return {
    storage,
    images: TestBed.inject(ImageStorageService),
    watch: TestBed.inject(WatchListService),
  };
}

function persistentImages() {
  // Independent services avoid a provisional-image map or an object-URL cache masking disk state.
  const storage = TestBed.runInInjectionContext(() => new StorageService());
  return TestBed.runInInjectionContext(() => {
    const injector = TestBed.inject(Injector);
    return Injector.create({
      parent: injector,
      providers: [{ provide: StorageService, useValue: storage }, ImageStorageService],
    }).get(ImageStorageService);
  });
}
