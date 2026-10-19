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

describe('Poster-only context conflicts', () => {
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

  it.each(['upload', 'delete', 'replace'])(
    'rejects a stale portable import after a poster-only %s',
    async (action) => {
      const writer = createPosterContext();
      await writer.storage.initialize();
      const originalId =
        action === 'upload'
          ? undefined
          : await writer.images.storeFile(new Blob(['original'], { type: 'image/png' }));
      const stale = createPosterContext();
      await stale.storage.initialize();
      const original = stale.storage.getData();
      const preferences = stale.preferences.exportSettings();
      const persistedPreferences = localStorage.getItem('suggestionProviders');
      let uploadedId: string | undefined;
      if (action === 'upload')
        uploadedId = await writer.images.storeFile(new Blob(['poster'], { type: 'image/png' }));
      else if (action === 'delete') await writer.images.delete(originalId);
      else
        await writer.images.replaceImages([
          { id: 'replacement', type: 'image/png', data: btoa('replacement') },
        ]);
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
      expect(reloaded.storage.getData()).toEqual(original);
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

  it('rejects an ordinary stale collection edit after a poster upload', async () => {
    const writer = createPosterContext();
    await writer.storage.initialize();
    const stale = createPosterContext();
    await stale.storage.initialize();
    await writer.images.storeFile(new Blob(['poster'], { type: 'image/png' }));
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
    const { storage } = createPosterContext();
    await storage.initialize();
    const outcomes: string[] = [];
    const poster = storage
      .writeImages((store) => {
        store.put({ id: 'poster', blob: new Blob(['poster'], { type: 'image/png' }) });
      })
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
    expect(await reloaded.images.getUrl('poster')).toBe('blob:poster');
  });

  describe.each([false, true])('initially loaded: %s', (initialized) => {
    it.each(['poster', 'collection'])(
      'preserves overlapping successful commands with %s first',
      async (first) => {
        const { storage } = createPosterContext();
        if (initialized) await storage.initialize();
        const savePoster = () =>
          storage.writeImages((store) => {
            store.put({ id: 'poster', blob: new Blob(['poster'], { type: 'image/png' }) });
          });
        const saveCollection = () =>
          storage.mutate((draft) => {
            draft.items['movie'] = {
              id: 'movie',
              title: 'Movie with poster',
              type: 'movie',
              status: 'not-started',
              groupId: 'ungrouped',
              posterId: 'poster',
              createdAt: '2026-10-18T12:00:00.000Z',
              isAdult: false,
              watchHistory: [],
            };
          });
        const writes =
          first === 'poster' ? [savePoster(), saveCollection()] : [saveCollection(), savePoster()];
        await Promise.all(writes);
        expect(storage.getConflictSignal()()).toBe(false);
        const reloaded = createPosterContext();
        await reloaded.storage.initialize();
        expect(reloaded.storage.getData().items['movie']).toMatchObject({
          title: 'Movie with poster',
          posterId: 'poster',
        });
        expect(await reloaded.images.getUrl('poster')).toBe('blob:poster');
        // A reload adopts the poster revision too, so its next edit must succeed.
        await reloaded.storage.mutate((draft) => {
          draft.items['movie'].title = 'Edited after reload';
        });
      },
    );
  });

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
      await expect(
        writer.storage.writeImages((store) => {
          store.put({ id: 'aborted', blob: new Blob(['poster'], { type: 'image/png' }) });
        }),
      ).rejects.toThrow();
      writes.mockRestore();
      const retrying = retryingContext === 'writer' ? writer : peer;
      await retrying.storage.mutate((draft) => {
        draft.groups['ungrouped'].name = 'After aborted poster';
      });
      const reloaded = createPosterContext();
      await reloaded.storage.initialize();
      expect(reloaded.storage.getGroups()[0].name).toBe('After aborted poster');
      expect(await reloaded.images.getUrl('aborted')).toBeNull();
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
      ImportExportService,
      ProviderSettingsService,
      BrowserSettingsStorage,
    ],
  });
  return {
    storage: injector.get(StorageService),
    images: injector.get(ImageStorageService),
    imports: injector.get(ImportExportService),
    preferences: injector.get(ProviderSettingsService),
  };
}
