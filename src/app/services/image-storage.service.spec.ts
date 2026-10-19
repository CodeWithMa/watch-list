import { IDBFactory, IDBObjectStore as FakeIDBObjectStore } from 'fake-indexeddb';
import { vi, afterEach, beforeEach, describe, it, expect } from 'vitest';
import { ImageStorageService } from './image-storage.service';
import { imageVersion, imagesInvalidated } from './image-invalidation';
import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { CURRENT_SCHEMA_VERSION } from '../models/storage.model';
import { WatchListDatabase } from './watch-list-database.service';
import { WatchListService } from './watch-list.service';
import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { injectPosterUrl } from './poster-reader';

async function persistImage(blob = createImageBlob()) {
  const images = TestBed.inject(ImageStorageService);
  const id = await images.storeFile(blob);
  await TestBed.inject(WatchListService).addItem({
    title: 'Movie',
    type: 'movie',
    status: 'not-started',
    groupId: 'ungrouped',
    isAdult: false,
    posterId: id,
  });
  return id;
}

function createImageBlob(content = 'fake-image', type = 'image/png', size?: number): Blob {
  const blob = new Blob([content], { type });
  if (size !== undefined) {
    Object.defineProperty(blob, 'size', { value: size });
  }
  return blob;
}

describe('ImageStorageService', () => {
  let origCreateImageBitmap: typeof globalThis.createImageBitmap;
  let origCreateObjectURL: typeof URL.createObjectURL;
  let origRevokeObjectURL: typeof URL.revokeObjectURL;
  let origFileReader: typeof FileReader;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: new IDBFactory(),
    });
    imageVersion.set(0);
    origCreateImageBitmap = globalThis.createImageBitmap;
    origCreateObjectURL = URL.createObjectURL;
    origRevokeObjectURL = URL.revokeObjectURL;
    origFileReader = globalThis.FileReader;

    globalThis.createImageBitmap = vi.fn(() =>
      Promise.resolve({ close: vi.fn() } as unknown as ImageBitmap),
    );
    URL.createObjectURL = vi.fn(() => 'blob:mock-url') as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

    // Mock FileReader to avoid jsdom/fake-indexeddb Blob realm issues
    const MockFileReader = class {
      result: string | ArrayBuffer | null = null;
      onload: ((e: ProgressEvent) => void) | null = null;
      onloadend: ((e: ProgressEvent) => void) | null = null;
      onerror: ((e: ProgressEvent) => void) | null = null;
      error: Error | null = null;
      readAsDataURL(blob: Blob) {
        const tryRead = async () => {
          try {
            let buffer: ArrayBuffer;
            const anyBlob = blob as unknown as {
              arrayBuffer?: () => Promise<ArrayBuffer>;
              text?: () => Promise<string>;
            };
            if (anyBlob.arrayBuffer) {
              buffer = await anyBlob.arrayBuffer();
            } else if (anyBlob.text) {
              const text = await anyBlob.text();
              buffer = new TextEncoder().encode(text).buffer as ArrayBuffer;
            } else {
              buffer = await new Response(blob as unknown as Blob).arrayBuffer();
            }
            const bytes = new Uint8Array(buffer);
            let binary = '';
            bytes.forEach((b) => (binary += String.fromCharCode(b)));
            const base64 = btoa(binary);
            this.result = `data:${blob.type};base64,${base64}`;
            const evt = new ProgressEvent('load');
            this.onload?.(evt);
            this.onloadend?.(evt);
          } catch {
            this.result = `data:${blob.type};base64,${btoa('hello')}`;
            const evt = new ProgressEvent('load');
            this.onload?.(evt);
            this.onloadend?.(evt);
          }
        };
        void tryRead();
      }
      readAsText(blob: Blob) {
        const tryRead = async () => {
          try {
            let text: string;
            const anyBlob = blob as unknown as {
              text?: () => Promise<string>;
              arrayBuffer?: () => Promise<ArrayBuffer>;
            };
            if (anyBlob.text) {
              text = await anyBlob.text();
            } else if (anyBlob.arrayBuffer) {
              const buffer = await anyBlob.arrayBuffer();
              text = new TextDecoder().decode(buffer);
            } else {
              text = await new Response(blob as unknown as Blob).text();
            }
            this.result = text;
            const evt = new ProgressEvent('load');
            this.onload?.(evt);
            this.onloadend?.(evt);
          } catch {
            this.result = '';
            const evt = new ProgressEvent('load');
            this.onload?.(evt);
            this.onloadend?.(evt);
          }
        };
        void tryRead();
      }
      readAsArrayBuffer(blob: Blob) {
        const tryRead = async () => {
          try {
            const anyBlob = blob as unknown as { arrayBuffer?: () => Promise<ArrayBuffer> };
            const buffer = anyBlob.arrayBuffer
              ? await anyBlob.arrayBuffer()
              : await new Response(blob as unknown as Blob).arrayBuffer();
            this.result = buffer;
            const evt = new ProgressEvent('load');
            this.onload?.(evt);
            this.onloadend?.(evt);
          } catch {
            this.result = new ArrayBuffer(0);
            const evt = new ProgressEvent('load');
            this.onload?.(evt);
            this.onloadend?.(evt);
          }
        };
        void tryRead();
      }
    };
    (globalThis as unknown as { FileReader: unknown }).FileReader =
      MockFileReader as unknown as typeof FileReader;

    if (!globalThis.crypto) (globalThis as unknown as { crypto: Crypto }).crypto = {} as Crypto;
    const fetchResponseBlob = new Blob(['img'], { type: 'image/png' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(fetchResponseBlob),
      } as unknown as Response),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.createImageBitmap = origCreateImageBitmap;
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    globalThis.FileReader = origFileReader;
  });

  it('prepares a valid image draft without persisting it', async () => {
    const service = TestBed.inject(ImageStorageService);
    const blob = createImageBlob('abc', 'image/png');
    const id = await service.storeFile(blob);
    expect(id).toMatch(/^image-/);
    expect(await service.exportImages()).toEqual([]);
    const url = await service.getUrl(id);
    expect(url).toBe('blob:mock-url');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it.each(['getUrl', 'exportImages'] as const)(
    'supports persistent collection edits when %s initializes the database first',
    async (read) => {
      const images = TestBed.inject(ImageStorageService);
      if (read === 'getUrl') expect(await images.getUrl('missing-poster')).toBeNull();
      else expect(await images.exportImages()).toEqual([]);

      const storage = TestBed.inject(StorageService);
      await storage.initialize();
      expect(storage.getInMemorySessionSignal()()).toBe(false);
      const data = storage.getData();
      data.groups['saved'] = { id: 'saved', name: 'Saved', order: 1 };
      await storage.replaceData(data);
      const id = await persistImage();

      const reloaded = TestBed.runInInjectionContext(() => new StorageService());
      await reloaded.initialize();
      expect(reloaded.getData().groups['saved'].name).toBe('Saved');
      expect(await images.getUrl(id)).toBe('blob:mock-url');
    },
  );

  it('retries poster access after an open failure without poisoning the URL cache', async () => {
    const images = TestBed.inject(ImageStorageService);
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('Storage unavailable');
    });

    await expect(images.getUrl('missing')).rejects.toThrow('Storage unavailable');
    expect(await images.getUrl('missing')).toBeNull();
    expect(await images.exportImages()).toEqual([]);
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    expect(storage.getInMemorySessionSignal()()).toBe(false);
  });

  it.each(['missing', 'rejected'])(
    'clears a %s poster warning after a successful retry',
    async (failure) => {
      const images = TestBed.inject(ImageStorageService);
      const id = failure === 'missing' ? 'missing-poster' : await persistImage();
      const storage = TestBed.inject(StorageService);
      await storage.initialize();
      const data = storage.getData();
      data.items['movie'] = {
        id: 'movie',
        title: 'Movie',
        type: 'movie',
        groupId: 'ungrouped',
        status: 'not-started',
        isAdult: false,
        createdAt: '2026-01-01',
        watchHistory: [],
        posterId: id,
      };
      await storage.replaceData(data);
      const fault =
        failure === 'rejected'
          ? vi.spyOn(FakeIDBObjectStore.prototype, 'get').mockImplementationOnce(() => {
              throw new Error('Poster temporarily unavailable');
            })
          : null;
      if (failure === 'rejected') await expect(images.getUrl(id)).rejects.toThrow(/temporarily/);
      else expect(await images.getUrl(id)).toBeNull();
      expect(images.unavailablePosters()).toBe(true);

      fault?.mockRestore();
      if (failure === 'missing')
        await storage.importDataWithImages(data, [{ id, blob: createImageBlob() }]);
      expect(await images.getUrl(id)).toBe('blob:mock-url');
      expect(images.unavailablePosters()).toBe(false);
    },
  );

  it('keeps warnings for remaining missing posters, then clears them after item removal and import', async () => {
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    const data = storage.getData();
    for (const id of ['first', 'second'])
      data.items[id] = {
        id,
        title: id,
        type: 'movie',
        groupId: 'ungrouped',
        status: 'not-started',
        isAdult: false,
        createdAt: '2026-01-01',
        watchHistory: [],
        posterId: id,
      };
    await storage.replaceData(data);
    const images = TestBed.inject(ImageStorageService);
    expect(await images.getUrl('first')).toBeNull();
    expect(await images.getUrl('second')).toBeNull();
    const firstOnly = storage.getData();
    delete firstOnly.items['second'].posterId;
    await storage.importDataWithImages(firstOnly, [{ id: 'first', blob: createImageBlob() }]);
    await storage.replaceData(data);
    expect(await images.getUrl('second')).toBeNull();
    expect(await images.getUrl('first')).toBe('blob:mock-url');
    expect(images.unavailablePosters()).toBe(true);

    await storage.mutate((draft) => {
      delete draft.items['second'];
    });
    expect(images.unavailablePosters()).toBe(false);
    await storage.replaceData(data);
    expect(await images.getUrl('second')).toBeNull();
    expect(images.unavailablePosters()).toBe(true);
    await storage.importDataWithImages(data, [
      { id: 'first', blob: createImageBlob() },
      { id: 'second', blob: createImageBlob() },
    ]);
    expect(await images.getUrl('second')).toBe('blob:mock-url');
    expect(images.unavailablePosters()).toBe(false);
  });

  it('exports only requested posters, without attempting to encode unrelated blobs', async () => {
    const images = TestBed.inject(ImageStorageService);
    const id = await persistImage();
    const storage = TestBed.inject(StorageService);
    await storage.importDataWithImages(storage.getData(), [
      { id, blob: createImageBlob() },
      // A damaged unrelated blob must never be read by a selected export.
      { id: 'unrelated', blob: null as unknown as Blob },
    ]);

    const exported = await images.exportImages(new Set([id]));
    expect(exported.map((image) => image.id)).toEqual([id]);
  });

  it('ignores a failed poster read invalidated before it settles', async () => {
    const images = TestBed.inject(ImageStorageService);
    const id = await persistImage();
    const storage = TestBed.inject(StorageService);
    const data = storage.getData();
    data.items['movie'] = {
      id: 'movie',
      title: 'Movie',
      type: 'movie',
      groupId: 'ungrouped',
      status: 'not-started',
      isAdult: false,
      createdAt: '2026-01-01',
      watchHistory: [],
      posterId: id,
    };
    await storage.replaceData(data);
    const get = FakeIDBObjectStore.prototype.get;
    const fault = vi.spyOn(FakeIDBObjectStore.prototype, 'get').mockImplementation(function (
      this: IDBObjectStore,
      key,
    ) {
      const request = get.call(this, key);
      if (this.name === 'images')
        request.addEventListener('success', () => {
          images.invalidateAll();
          this.transaction.abort();
        });
      return request;
    });

    await expect(images.getUrl(id)).rejects.toThrow();
    expect(images.unavailablePosters()).toBe(false);
    fault.mockRestore();
    expect(await images.getUrl(id)).toBe('blob:mock-url');
    expect(images.unavailablePosters()).toBe(false);
  });

  it('blocks poster changes before downloading or decoding when another tab upgrades the database', async () => {
    const storage = TestBed.inject(StorageService);
    const images = TestBed.inject(ImageStorageService);
    await storage.initialize();
    const future = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('watch-list', 4);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Obsolete connection blocked the upgrade'));
    });
    try {
      await expect(images.storeUrl('https://example.com/poster.png')).rejects.toThrow(/reload/i);
      await expect(images.storeFile(createImageBlob())).rejects.toThrow(/reload/i);
      expect(fetch).not.toHaveBeenCalled();
      expect(createImageBitmap).not.toHaveBeenCalled();
    } finally {
      future.close();
    }
  });

  it('reacquires the shared connection for metadata and posters after invalidation', async () => {
    const storage = TestBed.inject(StorageService);
    const images = TestBed.inject(ImageStorageService);
    await storage.initialize();
    const id = await persistImage();
    const data = storage.getData();
    data.groups['saved'] = { id: 'saved', name: 'Saved', order: 1 };

    TestBed.inject(WatchListDatabase).close();

    await storage.replaceData(data);
    expect(await images.getUrl(id)).toBe('blob:mock-url');
    const reloaded = TestBed.runInInjectionContext(() => new StorageService());
    await reloaded.initialize();
    expect(reloaded.getData().groups['saved'].name).toBe('Saved');
  });

  it('rejects a poster read aborted after its request succeeds and allows retry', async () => {
    const images = TestBed.inject(ImageStorageService);
    const id = await persistImage();
    const get = FakeIDBObjectStore.prototype.get;
    const spy = vi.spyOn(FakeIDBObjectStore.prototype, 'get').mockImplementation(function (
      this: IDBObjectStore,
      key,
    ) {
      const request = get.call(this, key);
      if (this.name === 'images') {
        request.addEventListener('success', () => this.transaction.abort());
      }
      return request;
    });

    await expect(images.getUrl(id)).rejects.toThrow();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    spy.mockRestore();
    expect(await images.getUrl(id)).toBe('blob:mock-url');
  });

  it('preserves metadata and posters when a portable import aborts after poster request success', async () => {
    const storage = TestBed.inject(StorageService);
    const images = TestBed.inject(ImageStorageService);
    await storage.initialize();
    await persistImage();
    const before = storage.getData();
    const posters = await images.exportImages();
    const changed = storage.getData();
    changed.groups['imported'] = { id: 'imported', name: 'Imported', order: 1 };
    const put = FakeIDBObjectStore.prototype.put;
    vi.spyOn(FakeIDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value,
      key,
    ) {
      const request = put.call(this, value, key);
      if (this.name === 'images') {
        request.addEventListener('success', () => this.transaction.abort());
      }
      return request;
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      storage.importDataWithImages(changed, [{ id: 'new', blob: createImageBlob() }]),
    ).rejects.toThrow();

    expect(storage.getData()).toEqual(before);
    const reloaded = TestBed.runInInjectionContext(() => new StorageService());
    await reloaded.initialize();
    expect(reloaded.getData()).toEqual(before);
    expect(await images.exportImages()).toEqual(posters);
  });

  it.each(['item', 'import'] as const)(
    'preserves newer cross-tab posters when an initialized tab attempts %s',
    async (operation) => {
      const storage = TestBed.inject(StorageService);
      await storage.initialize();
      const service = TestBed.inject(ImageStorageService);
      const database = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('watch-list');
        request.onsuccess = () => resolve(request.result);
      });
      const raw = { schemaVersion: CURRENT_SCHEMA_VERSION + 1, futureRecords: ['keep'] };
      const image = { id: 'future-poster', futureBytes: [1, 2, 3] };
      const transaction = database.transaction(['storage', 'images'], 'readwrite');
      transaction.objectStore('storage').put(raw, 'watch-list-data');
      transaction.objectStore('images').put(image);
      await new Promise<void>((resolve) => (transaction.oncomplete = () => resolve()));

      const write =
        operation === 'import'
          ? storage.importDataWithImages(storage.getData(), [])
          : TestBed.inject(WatchListService).addItem({
              title: 'Movie',
              type: 'movie',
              status: 'not-started',
              groupId: 'ungrouped',
              isAdult: false,
              posterId: await service.storeFile(createImageBlob()),
            });
      await expect(write).rejects.toThrow(/newer version of Watch List/);

      expect(storage.getCompatibilityErrorSignal()()?.version).toBe(CURRENT_SCHEMA_VERSION + 1);
      expect(storage.getDataSignal()()).toBeNull();
      expect(storage.getUnsupportedData()).toEqual(raw);
      const request = database.transaction('images').objectStore('images').getAll();
      const remaining = await new Promise<unknown>((resolve) => {
        request.onsuccess = () => resolve(request.result);
      });
      expect(remaining).toEqual([image]);
      database.close();
    },
  );

  it('rejects empty, oversized and non-image blobs', async () => {
    const service = TestBed.inject(ImageStorageService);
    await expect(service.storeFile(createImageBlob('', 'image/png'))).rejects.toThrow(
      '5 MB or smaller',
    );
    await expect(
      service.storeFile(createImageBlob('x', 'image/png', 6 * 1024 * 1024)),
    ).rejects.toThrow('5 MB or smaller');
    await expect(service.storeFile(createImageBlob('x', 'text/plain'))).rejects.toThrow(
      'browser-supported image',
    );
  });

  it('rejects when createImageBitmap fails', async () => {
    const service = TestBed.inject(ImageStorageService);
    globalThis.createImageBitmap = vi.fn(() => Promise.reject(new Error('bad image')));
    await expect(service.storeFile(createImageBlob('x', 'image/png'))).rejects.toThrow(
      'browser-supported image',
    );
  });

  it('stores URL via fetch', async () => {
    const service = TestBed.inject(ImageStorageService);
    const id = await service.storeUrl('https://example.com/poster.jpg');
    expect(fetch).toHaveBeenCalledWith('https://example.com/poster.jpg');
    expect(id).toMatch(/^image-/);
  });

  it('throws when fetch fails or response not ok', async () => {
    const service = TestBed.inject(ImageStorageService);
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network'));
    await expect(service.storeUrl('https://example.com/a.jpg')).rejects.toThrow('Check the URL');
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      blob: () => Promise.resolve(new Blob()),
    } as unknown as Response);
    await expect(service.storeUrl('https://example.com/b.jpg')).rejects.toThrow(
      'Could not download',
    );
  });

  it('getUrl returns null for undefined and caches promise', async () => {
    const service = TestBed.inject(ImageStorageService);
    expect(await service.getUrl(undefined)).toBeNull();
    const blob = createImageBlob('abc', 'image/png');
    const id = await service.storeFile(blob);
    const p1 = service.getUrl(id);
    const p2 = service.getUrl(id);
    const [v1, v2] = await Promise.all([p1, p2]);
    expect(v1).toBe('blob:mock-url');
    expect(v2).toBe('blob:mock-url');
    // second call still cached returns same resolved value
    await expect(service.getUrl(id)).resolves.toBe('blob:mock-url');
  });

  it('discards a draft and revokes its preview URL', async () => {
    const service = TestBed.inject(ImageStorageService);
    const blob = createImageBlob('abc', 'image/png');
    const id = await service.storeFile(blob);
    await service.getUrl(id);
    service.discardDraft(id);
    await Promise.resolve();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    const url2 = await service.getUrl(id);
    expect(url2).toBeNull();
  });

  it('keeps cached URLs shared when a pending poster reader is destroyed', async () => {
    const images = TestBed.inject(ImageStorageService);
    const id = await images.storeFile(createImageBlob());
    const parent = TestBed.inject(EnvironmentInjector);
    const first = createEnvironmentInjector([], parent);
    const second = createEnvironmentInjector([], parent);
    const firstUrl = runInInjectionContext(first, () => injectPosterUrl(() => id));
    const secondUrl = runInInjectionContext(second, () => injectPosterUrl(() => id));
    TestBed.tick();
    first.destroy();

    await vi.waitFor(() => expect(secondUrl()).toBe('blob:mock-url'));
    expect(firstUrl()).toBeNull();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    second.destroy();
    await expect(images.getUrl(id)).resolves.toBe('blob:mock-url');
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    images.discardDraft(id);
    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url'));
  });

  it('exports images as base64', async () => {
    const service = TestBed.inject(ImageStorageService);
    const blob = createImageBlob('hello', 'image/png');
    const id = await persistImage(blob);
    const exported = await service.exportImages();
    expect(exported).toHaveLength(1);
    expect(exported[0].id).toBe(id);
    expect(exported[0].data).toBeTruthy();
    expect(typeof exported[0].data).toBe('string');
  });

  it('imports parsed images with collection replacement and invalidates cached URLs', async () => {
    const service = TestBed.inject(ImageStorageService);
    const blob = createImageBlob('old', 'image/png');
    const oldId = await persistImage(blob);
    await service.getUrl(oldId);

    const before = imageVersion();
    const newImages = [{ id: 'image-new', type: 'image/png', data: btoa('newdata') }];
    const storage = TestBed.inject(StorageService);
    await storage.importDataWithImages(
      storage.getData(),
      await service.parseExportedImages(newImages),
    );

    expect(URL.revokeObjectURL).toHaveBeenCalled();
    expect(imageVersion()).toBeGreaterThan(before);
    const exported = await service.exportImages();
    expect(exported.some((i) => i.id === 'image-new')).toBe(true);
    expect(exported.some((i) => i.id === oldId)).toBe(false);
  });

  it('parseExportedImages throws for invalid data', async () => {
    const service = TestBed.inject(ImageStorageService);
    await expect(service.parseExportedImages(null)).rejects.toThrow('Invalid image data');
    await expect(service.parseExportedImages([{ id: 'x' }])).rejects.toThrow('Invalid image data');
    await expect(
      service.parseExportedImages([{ id: 123, type: 'image/png', data: 'abc' }]),
    ).rejects.toThrow('Invalid image data');
    await expect(
      service.parseExportedImages([{ id: 'x', type: 'text/plain', data: btoa('x') }]),
    ).rejects.toThrow('browser-supported');
  });

  it('invalidateAll triggers refreshCache and increments version', async () => {
    const service = TestBed.inject(ImageStorageService);
    const blob = createImageBlob('abc', 'image/png');
    const id = await service.storeFile(blob);
    await service.getUrl(id);
    const before = imageVersion();
    service.invalidateAll();
    // revoke is async (void), wait a tick
    await new Promise((r) => setTimeout(r, 0));
    expect(imageVersion()).toBeGreaterThan(before);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('handles cache revocation errors gracefully', async () => {
    const service = TestBed.inject(ImageStorageService);
    const blob = createImageBlob('abc', 'image/png');
    const id = await service.storeFile(blob);
    const urlPromise = service.getUrl(id);
    // Make URL.createObjectURL throw? Actually revoke path catches errors
    URL.revokeObjectURL = vi.fn(() => {
      throw new Error('revoke fail');
    }) as unknown as typeof URL.revokeObjectURL;
    service.discardDraft(id);
    await expect(urlPromise).resolves.toBe('blob:mock-url');
    expect(() => service.discardDraft(id)).not.toThrow();
  });

  it('handles imageVersion subscription', async () => {
    const uniqueUrl = 'blob:unique-image-version-test';
    URL.createObjectURL = vi.fn(() => uniqueUrl) as unknown as typeof URL.createObjectURL;
    const service = TestBed.inject(ImageStorageService);
    const blob = createImageBlob('abc', 'image/png');
    const id = await service.storeFile(blob);
    await service.getUrl(id);
    const before = imageVersion();
    imagesInvalidated.next();
    await new Promise((r) => setTimeout(r, 0));
    expect(imageVersion()).toBeGreaterThan(before);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(uniqueUrl);
  });
});
