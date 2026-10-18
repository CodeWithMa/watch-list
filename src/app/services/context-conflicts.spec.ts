import { Injector } from '@angular/core';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { CollectionConflictError, StorageService } from './storage.service';
import { WatchListDatabase } from './watch-list-database.service';
import { ImportExportService } from './import-export.service';
import { ImageStorageService } from './image-storage.service';
import { ProviderSettingsService } from './provider-settings.service';
import { createDefaultStorageData } from '../domain/storage-schema';
import { controlStorageWrites } from './indexeddb-write.test-utils';

describe('Collection context conflicts', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['intent', 'snapshot', 'item snapshot', 'raw import', 'posters'])(
    'rejects a stale %s writer without overwriting a committed change',
    async (action) => {
      const first = createContext();
      await first.initialize();
      const stale = createContext();
      await stale.initialize();
      await first.mutate((draft) => {
        draft.groups['ungrouped'].name = 'First writer';
      });

      const snapshot = stale.getData();
      snapshot.groups['ungrouped'].name = 'Stale writer';
      const writePosters = vi.fn();
      const write =
        action === 'snapshot'
          ? stale.saveData(snapshot)
          : action === 'item snapshot'
            ? stale.saveItemChanges(snapshot)
            : action === 'raw import'
              ? stale.importData(snapshot)
              : action === 'posters'
                ? stale.writeImages(writePosters)
                : stale.mutate((draft) => {
                    draft.groups['ungrouped'].name = 'Stale writer';
                  });
      await expect(write).rejects.toBeInstanceOf(CollectionConflictError);
      expect(writePosters).not.toHaveBeenCalled();

      const reloaded = createContext();
      await reloaded.initialize();
      expect(reloaded.getGroups()[0].name).toBe('First writer');
      expect(stale.getDatabaseErrorSignal()()).toBeNull();
      expect(stale.getInMemorySessionSignal()()).toBe(false);
    },
  );

  it('requires an explicit refresh before a stale context can retry successfully', async () => {
    const first = createContext();
    await first.initialize();
    const stale = createContext();
    await stale.initialize();
    await first.mutate((draft) => {
      draft.groups['ungrouped'].name = 'Latest name';
    });
    const edit = () =>
      stale.mutate((draft) => {
        draft.items = {};
      });
    await expect(edit()).rejects.toThrow(/changed in another/);
    expect(stale.getConflictSignal()()).toBe(true);
    await expect(edit()).rejects.toThrow(/changed in another/);
    expect(stale.getGroups()[0].name).toBe('Ungrouped');

    await stale.refresh();
    expect(stale.getConflictSignal()()).toBe(false);
    expect(stale.getGroups()[0].name).toBe('Latest name');
    await expect(edit()).resolves.toMatchObject({ durability: 'persistent' });
    const reloaded = createContext();
    await reloaded.initialize();
    expect(reloaded.getGroups()[0].name).toBe('Latest name');
  });

  it('rejects a portable replacement atomically, retaining posters and preferences until refresh and reconfirmation', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:poster');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }));
    const first = createContext();
    await first.initialize();
    const injector = Injector.create({
      providers: [
        StorageService,
        WatchListDatabase,
        ImportExportService,
        ImageStorageService,
        ProviderSettingsService,
      ],
    });
    const stale = injector.get(StorageService);
    const images = injector.get(ImageStorageService);
    const preferences = injector.get(ProviderSettingsService);
    await stale.initialize();
    const originalId = await images.storeFile(new Blob(['original poster'], { type: 'image/png' }));
    const originalPreferences = preferences.exportSettings();
    await first.mutate((draft) => {
      draft.groups['ungrouped'].name = 'External edit';
    });
    const replacement = createDefaultStorageData();
    replacement.groups['ungrouped'].name = 'Imported group';
    const payload = {
      data: replacement,
      images: [{ id: 'imported-poster', type: 'image/png', data: btoa('imported poster') }],
      preferences: { providerSettings: { ...originalPreferences, includeAdult: true } },
    };
    const file = { text: async () => JSON.stringify(payload) } as File;
    const imports = injector.get(ImportExportService);
    await expect(imports.importData(file)).rejects.toThrow(/changed in another/);
    images.invalidateAll();
    expect(await images.getUrl(originalId)).toBe('blob:poster');
    expect(await images.getUrl('imported-poster')).toBeNull();
    expect(preferences.exportSettings()).toEqual(originalPreferences);
    const afterConflict = createContext();
    await afterConflict.initialize();
    expect(afterConflict.getGroups()[0].name).toBe('External edit');

    await stale.refresh();
    await imports.importData(file);
    expect(preferences.isAdultIncluded()).toBe(true);
    expect(await images.getUrl(originalId)).toBeNull();
    expect(await images.getUrl('imported-poster')).toBe('blob:poster');
    const afterImport = createContext();
    await afterImport.initialize();
    expect(afterImport.getGroups()[0].name).toBe('Imported group');
    await expect(first.mutate(() => undefined)).rejects.toThrow(/changed in another/);
    await afterImport.mutate((draft) => {
      draft.groups['ungrouped'].name = 'After reload';
    });
    await expect(stale.mutate(() => undefined)).rejects.toThrow(/changed in another/);
  });

  it('does not replay a stale replacement submitted while refresh is pending', async () => {
    const first = createContext();
    await first.initialize();
    const stale = createContext();
    await stale.initialize();
    const snapshot = stale.getData();
    await first.mutate((draft) => {
      draft.groups['ungrouped'].name = 'Keep external edit';
    });
    const refreshing = stale.refresh();
    await expect(stale.saveData(snapshot)).rejects.toThrow(/refresh/i);
    await refreshing;
    const reloaded = createContext();
    await reloaded.initialize();
    expect(reloaded.getGroups()[0].name).toBe('Keep external edit');
  });

  it('rejects import confirmation during refresh before delayed file preparation can outlive it', async () => {
    const first = createContext();
    await first.initialize();
    const injector = Injector.create({
      providers: [
        StorageService,
        WatchListDatabase,
        ImportExportService,
        ImageStorageService,
        ProviderSettingsService,
      ],
    });
    const stale = injector.get(StorageService);
    await stale.initialize();
    await first.mutate((draft) => {
      draft.groups['ungrouped'].name = 'Keep external edit';
    });
    await expect(stale.mutate(() => undefined)).rejects.toThrow(/changed in another/);
    let finishRead: (text: string) => void = () => undefined;
    const read = new Promise<string>((resolve) => {
      finishRead = resolve;
    });
    const text = vi.fn(() => read);
    const refreshing = stale.refresh();
    const importing = injector.get(ImportExportService).importData({ text } as unknown as File);
    const rejected = expect(importing).rejects.toThrow(/refresh/i);
    await refreshing;
    finishRead(JSON.stringify(createDefaultStorageData()));
    await rejected;
    expect(text).not.toHaveBeenCalled();
    expect(stale.getGroups()[0].name).toBe('Keep external edit');
  });

  it('invalidates an earlier import confirmation when refresh happens during file preparation', async () => {
    const first = createContext();
    await first.initialize();
    const injector = Injector.create({
      providers: [
        StorageService,
        WatchListDatabase,
        ImportExportService,
        ImageStorageService,
        ProviderSettingsService,
      ],
    });
    const stale = injector.get(StorageService);
    await stale.initialize();
    let finishRead: (text: string) => void = () => undefined;
    const read = new Promise<string>((resolve) => {
      finishRead = resolve;
    });
    const importing = injector
      .get(ImportExportService)
      .importData({ text: () => read } as unknown as File);
    const rejected = expect(importing).rejects.toBeInstanceOf(CollectionConflictError);
    await first.mutate((draft) => {
      draft.groups['ungrouped'].name = 'Keep external edit';
    });
    await expect(stale.mutate(() => undefined)).rejects.toThrow(/changed in another/);
    await stale.refresh();
    finishRead(JSON.stringify(createDefaultStorageData()));
    await rejected;
    const reloaded = createContext();
    await reloaded.initialize();
    expect(reloaded.getGroups()[0].name).toBe('Keep external edit');
  });

  it('serializes simultaneous writers across independent connections', async () => {
    const first = createContext();
    const second = createContext();
    await Promise.all([first.initialize(), second.initialize()]);
    const results = await Promise.allSettled([
      first.mutate((draft) => {
        draft.groups['ungrouped'].name = 'First';
      }),
      second.mutate((draft) => {
        draft.groups['ungrouped'].name = 'Second';
      }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const reloaded = createContext();
    await reloaded.initialize();
    expect(reloaded.getGroups()[0].name).toBe(
      results[0].status === 'fulfilled' ? 'First' : 'Second',
    );
  });

  it.each(['writer', 'peer'])(
    'does not advance the revision on abort and keeps the %s current',
    async (retryingContext) => {
      const first = createContext();
      await first.initialize();
      const peer = createContext();
      await peer.initialize();
      const writes = controlStorageWrites([false]);
      await expect(
        first.mutate((draft) => {
          draft.groups['ungrouped'].name = 'Aborted';
        }),
      ).rejects.toThrow();
      writes.mockRestore();
      expect(first.getConflictSignal()()).toBe(false);
      const retrying = retryingContext === 'writer' ? first : peer;
      await retrying.mutate((draft) => {
        draft.groups['ungrouped'].name = 'Retry after abort';
      });
      await peer.refresh();
      expect(peer.getGroups()[0].name).toBe('Retry after abort');
      await peer.mutate((draft) => {
        draft.groups['ungrouped'].name = 'Peer succeeds';
      });
      await expect(first.mutate(() => undefined)).rejects.toThrow(/changed in another/);
    },
  );

  it('initializes a revision for an existing collection without changing its document', async () => {
    const owner = new WatchListDatabase();
    const database = await owner.open();
    const original = createDefaultStorageData();
    original.groups['ungrouped'].name = 'Existing collection';
    const transaction = database.transaction('storage', 'readwrite');
    transaction.objectStore('storage').put(original, 'watch-list-data');
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    owner.close();
    const first = createContext();
    const second = createContext();
    await Promise.all([first.initialize(), second.initialize()]);
    expect(first.getData()).toEqual(original);
    expect(second.getData()).toEqual(original);
    expect(first.getInMemorySessionSignal()()).toBe(false);
    expect(second.getInMemorySessionSignal()()).toBe(false);
    await first.mutate((draft) => {
      draft.groups['ungrouped'].name = 'New name';
    });
    await expect(second.mutate(() => undefined)).rejects.toThrow(/changed in another/);
    const reloaded = createContext();
    await reloaded.initialize();
    expect(reloaded.getGroups()[0].name).toBe('New name');
  });

  it('keeps independent session-only edits coherent without claiming shared persistence', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('Offline storage unavailable');
    });
    const first = createContext();
    const second = createContext();
    await Promise.all([first.initialize(), second.initialize()]);
    await expect(
      first.mutate((draft) => {
        draft.groups['ungrouped'].name = 'Session edit';
      }),
    ).resolves.toMatchObject({ durability: 'session-only' });
    expect(second.getGroups()[0].name).toBe('Ungrouped');
    expect(first.getConflictSignal()()).toBe(false);
    await expect(first.refresh()).rejects.toThrow(/Session-only/);
    expect(first.getGroups()[0].name).toBe('Session edit');
    expect(first.getInMemorySessionSignal()()).toBe(true);
  });
});

function createContext() {
  return Injector.create({ providers: [StorageService, WatchListDatabase] }).get(StorageService);
}
