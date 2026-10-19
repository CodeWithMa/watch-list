import { TestBed } from '@angular/core/testing';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { StorageService } from './storage.service';
import { ImportExportService } from './import-export.service';
import { ImageStorageService } from './image-storage.service';
import { WatchListDatabase } from './watch-list-database.service';

describe('session metadata recovery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([false, true])(
    'recovers session metadata with unavailable IndexedDB (localStorage also unavailable: %s)',
    async (settingsUnavailable) => {
      vi.stubGlobal('indexedDB', new IDBFactory());
      const disk = TestBed.runInInjectionContext(() => new StorageService());
      await disk.initialize();
      await disk.mutate((draft) => {
        draft.groups['ungrouped'].name = 'Older disk collection';
      });
      TestBed.inject(WatchListDatabase).close();
      const openFailure = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        throw new DOMException('Storage denied', 'SecurityError');
      });
      if (settingsUnavailable)
        vi.stubGlobal('localStorage', {
          getItem: () => {
            throw new DOMException('Storage denied', 'SecurityError');
          },
          setItem: () => {
            throw new DOMException('Storage denied', 'SecurityError');
          },
        });
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const storage = TestBed.inject(StorageService);
      await storage.initialize();
      await storage.mutate((draft) => {
        draft.groups['ungrouped'].name = 'Session edits';
        draft.items['movie'] = {
          id: 'movie',
          title: 'Recover me',
          type: 'movie',
          groupId: 'ungrouped',
          status: 'not-started',
          isAdult: false,
          createdAt: '2026-01-01',
          watchHistory: [],
          posterId: 'unavailable-poster',
        };
      });
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      const download = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recovery');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      const exports = TestBed.inject(ImportExportService);

      const report = await exports.exportData();
      const blob = download.mock.calls[0][0] as Blob;
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      });
      expect(report).toEqual({
        included: 0,
        omittedIds: ['unavailable-poster'],
        unavailable: true,
      });
      expect(JSON.parse(text)).toMatchObject({ images: [], posters: report });
      expect(storage.getData().items['movie'].posterId).toBe('unavailable-poster');

      const beforeRejectedImport = storage.getData();
      vi.stubGlobal('createImageBitmap', async () => ({ close: () => undefined }));
      const withImages = new File([], 'images.json');
      Object.defineProperty(withImages, 'text', {
        value: async () =>
          JSON.stringify({
            data: { ...beforeRejectedImport, items: {} },
            images: [{ id: 'new-poster', type: 'image/png', data: btoa('poster') }],
          }),
      });
      await expect(exports.importData(withImages)).rejects.toThrow(/Cannot import posters/);
      expect(storage.getData()).toEqual(beforeRejectedImport);

      await storage.mutate((draft) => {
        draft.groups['ungrouped'].name = 'Temporary';
      });
      const file = new File([], 'session-recovery.json');
      Object.defineProperty(file, 'text', { value: async () => text });
      const imported = await exports.importData(file);
      expect(imported).toMatchObject({ durability: 'session-only', posters: report });
      expect(storage.getData().groups['ungrouped'].name).toBe('Session edits');
      expect(storage.getData().items['movie'].title).toBe('Recover me');
      expect(storage.getData().items['movie'].posterId).toBeUndefined();
      expect(
        await TestBed.inject(ImageStorageService).getUrl(storage.getData().items['movie'].posterId),
      ).toBeNull();
      expect(storage.getInMemorySessionSignal()()).toBe(true);

      // Reconnecting a poster reader must never reload older disk data over session edits.
      openFailure.mockRestore();
      expect(await TestBed.inject(ImageStorageService).exportImages()).toEqual([]);
      await storage.initialize();
      await expect(storage.refresh()).rejects.toThrow(/Session-only/);
      expect(storage.getData().groups['ungrouped'].name).toBe('Session edits');
      expect(storage.getInMemorySessionSignal()()).toBe(true);
      const reloaded = TestBed.runInInjectionContext(() => new StorageService());
      await reloaded.initialize();
      expect(reloaded.getData().groups['ungrouped'].name).toBe('Older disk collection');
      // Explicit recovery into a persistent context is deliberate and can then survive reload.
      await reloaded.importDataWithImages(JSON.parse(text).data, []);
      const recovered = TestBed.runInInjectionContext(() => new StorageService());
      await recovered.initialize();
      expect(recovered.getData().items['movie'].title).toBe('Recover me');
    },
  );

  it('exports metadata despite an image-store read failure without modifying the collection', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    await storage.mutate((draft) => {
      draft.groups['ungrouped'].name = 'Keep metadata';
    });
    const before = storage.getData();
    vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(() => {
      throw new Error('Images unavailable');
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const download = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:metadata');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    await expect(TestBed.inject(ImportExportService).exportData()).resolves.toEqual({
      included: 0,
      omittedIds: [],
      unavailable: true,
    });
    expect(download).toHaveBeenCalledOnce();
    expect(storage.getData()).toEqual(before);
    expect(storage.getInMemorySessionSignal()()).toBe(false);
  });

  it('imports older metadata-only exports without dangling posters or trusting an image count', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    const data = storage.getData();
    data.items['movie'] = {
      id: 'movie',
      title: 'Metadata only',
      type: 'movie',
      groupId: 'ungrouped',
      status: 'not-started',
      isAdult: false,
      createdAt: '2026-01-01',
      watchHistory: [],
      posterId: 'missing-poster',
    };
    const file = new File([], 'older-export.json');
    Object.defineProperty(file, 'text', {
      value: async () =>
        JSON.stringify({
          data,
          images: [],
          posters: { included: 99, omittedIds: [], unavailable: false },
        }),
    });

    const report = await TestBed.inject(ImportExportService).importData(file);
    expect(storage.getData().items['movie'].posterId).toBeUndefined();
    expect(report.posters).toEqual({
      included: 0,
      omittedIds: ['missing-poster'],
      unavailable: false,
    });
  });

  it('recovers metadata without requiring a writable image store', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    const data = storage.getData();
    data.groups['ungrouped'].name = 'Recovered without posters';
    vi.spyOn(IDBObjectStore.prototype, 'clear').mockImplementation(() => {
      throw new Error('Poster store is unwritable');
    });
    const file = new File([], 'metadata-recovery.json');
    Object.defineProperty(file, 'text', {
      value: async () =>
        JSON.stringify({
          data,
          images: [],
          posters: { included: 0, omittedIds: ['lost'], unavailable: true },
        }),
    });

    await expect(TestBed.inject(ImportExportService).importData(file)).resolves.toMatchObject({
      durability: 'persistent',
      posters: { included: 0, omittedIds: ['lost'], unavailable: true },
    });
    expect(storage.getGroups()[0].name).toBe('Recovered without posters');
    const reloaded = TestBed.runInInjectionContext(() => new StorageService());
    await reloaded.initialize();
    expect(reloaded.getGroups()[0].name).toBe('Recovered without posters');
  });
});
