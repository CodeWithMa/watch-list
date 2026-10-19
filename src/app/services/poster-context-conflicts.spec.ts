import { Injector } from '@angular/core';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { createDefaultStorageData } from '../domain/storage-schema';
import { CollectionConflictError, StorageService } from './storage.service';
import { ImageStorageService } from './image-storage.service';
import { ImportExportService } from './import-export.service';
import { ProviderSettingsService } from './provider-settings.service';
import { BrowserSettingsStorage } from './browser-settings-storage.service';
import { WatchListDatabase } from './watch-list-database.service';
import { WatchListService } from './watch-list.service';

describe('Poster persistence context conflicts', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:poster');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['add', 'delete', 'replace'])(
    'rejects a stale portable import after a collection/poster %s',
    async (action) => {
      const writer = createPosterContext();
      await writer.storage.initialize();
      const originalItem = action === 'add' ? undefined : await addWithPoster(writer);
      const originalId = originalItem?.posterId;
      const stale = createPosterContext();
      await stale.storage.initialize();
      const preferences = stale.preferences.exportSettings();
      const persistedPreferences = localStorage.getItem('suggestionProviders');
      let uploadedId: string | undefined;
      if (action === 'add') uploadedId = (await addWithPoster(writer)).posterId;
      else if (action === 'delete') await writer.watch.deleteItem(originalItem!.id);
      else
        await writer.storage.importDataWithImages(createDefaultStorageData(), [
          { id: 'replacement', blob: new Blob(['replacement'], { type: 'image/png' }) },
        ]);
      const committed = writer.storage.getData();
      const replacement = createDefaultStorageData();
      replacement.groups['ungrouped'].name = 'Imported group';
      const file = {
        text: async () =>
          JSON.stringify({
            data: replacement,
            images: originalId
              ? [{ id: originalId, type: 'image/png', data: btoa('original') }]
              : [],
            preferences: { providerSettings: { ...preferences, includeAdult: true } },
          }),
      } as File;

      await expect(stale.imports.importData(file)).rejects.toBeInstanceOf(CollectionConflictError);

      const reloaded = createPosterContext();
      await reloaded.storage.initialize();
      expect(reloaded.storage.getData()).toEqual(committed);
      if (uploadedId) expect(await reloaded.images.getUrl(uploadedId)).toBe('blob:poster');
      if (originalId) expect(await reloaded.images.getUrl(originalId)).toBeNull();
      expect(await reloaded.images.getUrl('replacement')).toBe(
        action === 'replace' ? 'blob:poster' : null,
      );
      expect(stale.preferences.exportSettings()).toEqual(preferences);
      expect(localStorage.getItem('suggestionProviders')).toBe(persistedPreferences);
      expect(stale.storage.getConflictSignal()()).toBe(true);
      expect(stale.storage.getInMemorySessionSignal()()).toBe(false);
      await stale.storage.refresh();
      await stale.storage.mutate((draft) => {
        draft.groups['ungrouped'].name = 'Saved after refresh';
      });
      const afterRetry = createPosterContext();
      await afterRetry.storage.initialize();
      expect(afterRetry.storage.getGroups()[0].name).toBe('Saved after refresh');
    },
  );

  it('rejects an ordinary stale collection edit after an item/poster commit', async () => {
    const writer = createPosterContext();
    await writer.storage.initialize();
    const stale = createPosterContext();
    await stale.storage.initialize();
    await addWithPoster(writer);
    await expect(
      stale.storage.mutate((draft) => {
        draft.groups['ungrouped'].name = 'Stale edit';
      }),
    ).rejects.toBeInstanceOf(CollectionConflictError);
    const reloaded = createPosterContext();
    await reloaded.storage.initialize();
    expect(reloaded.storage.getGroups()[0].name).toBe('Ungrouped');
  });

  it('settles an earlier poster command before validating a later collection command', async () => {
    const context = createPosterContext();
    const { storage } = context;
    await storage.initialize();
    const outcomes: string[] = [];
    const posterId = await context.images.storeFile(new Blob(['poster'], { type: 'image/png' }));
    const poster = context.watch
      .addItem({ ...movie, posterId })
      .then(() => outcomes.push('poster saved'));
    const edit = storage
      .mutate(() => {
        throw new Error('Invalid edit');
      })
      .catch(() => outcomes.push('edit rejected'));
    await Promise.all([poster, edit]);
    expect(outcomes).toEqual(['poster saved', 'edit rejected']);
    const reloaded = createPosterContext();
    await reloaded.storage.initialize();
    expect(await reloaded.images.getUrl(posterId)).toBe('blob:poster');
  });

  it.each(['poster', 'collection'])(
    'preserves overlapping successful commands with %s first',
    async (first) => {
      const context = createPosterContext();
      const { storage } = context;
      const posterId = await context.images.storeFile(new Blob(['poster'], { type: 'image/png' }));
      const savePoster = () => context.watch.addItem({ ...movie, posterId });
      const saveCollection = () =>
        storage.mutate((draft) => {
          draft.groups['ungrouped'].name = 'Concurrent edit';
        });
      const writes =
        first === 'poster' ? [savePoster(), saveCollection()] : [saveCollection(), savePoster()];
      await Promise.all(writes);
      expect(storage.getConflictSignal()()).toBe(false);
      const reloaded = createPosterContext();
      await reloaded.storage.initialize();
      expect(reloaded.storage.getItems()[0]).toMatchObject({
        title: 'Movie with poster',
        posterId,
      });
      expect(reloaded.storage.getGroups()[0].name).toBe('Concurrent edit');
      expect(await reloaded.images.getUrl(posterId)).toBe('blob:poster');
      // A reload adopts the poster revision too, so its next edit must succeed.
      await reloaded.storage.mutate((draft) => {
        draft.items[reloaded.storage.getItems()[0].id].title = 'Edited after reload';
      });
    },
  );

  it.each(['writer', 'peer'])(
    'does not advance either revision on poster transaction abort (%s retries)',
    async (retryingContext) => {
      const writer = createPosterContext();
      await writer.storage.initialize();
      const peer = createPosterContext();
      await peer.storage.initialize();
      const put = IDBObjectStore.prototype.put;
      const writes = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
        this: IDBObjectStore,
        value,
        key,
      ) {
        const request = put.call(this, value, key);
        if (this.name === 'images')
          request.addEventListener('success', () => this.transaction.abort());
        return request;
      });
      const posterId = await writer.images.storeFile(new Blob(['poster'], { type: 'image/png' }));
      await expect(writer.watch.addItem({ ...movie, posterId })).rejects.toThrow();
      writes.mockRestore();
      const retrying = retryingContext === 'writer' ? writer : peer;
      await retrying.storage.mutate((draft) => {
        draft.groups['ungrouped'].name = 'After aborted poster';
      });
      const reloaded = createPosterContext();
      await reloaded.storage.initialize();
      expect(reloaded.storage.getGroups()[0].name).toBe('After aborted poster');
      expect(await reloaded.images.getUrl(posterId)).toBeNull();
      expect(reloaded.storage.getItems()).toEqual([]);
      expect(writer.storage.getConflictSignal()()).toBe(false);
    },
  );
});

function createPosterContext() {
  const injector = Injector.create({
    providers: [
      StorageService,
      WatchListDatabase,
      ImageStorageService,
      WatchListService,
      ImportExportService,
      ProviderSettingsService,
      BrowserSettingsStorage,
    ],
  });
  return {
    storage: injector.get(StorageService),
    images: injector.get(ImageStorageService),
    watch: injector.get(WatchListService),
    imports: injector.get(ImportExportService),
    preferences: injector.get(ProviderSettingsService),
  };
}

const movie = {
  title: 'Movie with poster',
  type: 'movie',
  status: 'not-started',
  groupId: 'ungrouped',
  isAdult: false,
} as const;

async function addWithPoster(context: ReturnType<typeof createPosterContext>) {
  const posterId = await context.images.storeFile(new Blob(['poster'], { type: 'image/png' }));
  return (await context.watch.addItem({ ...movie, posterId })).value;
}
