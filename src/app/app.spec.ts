import { DOCUMENT, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { IDBFactory } from 'fake-indexeddb';
import { Subject } from 'rxjs';
import { afterEach, vi } from 'vitest';
import { App } from './app';
import { StorageService } from './services/storage.service';
import { ImageStorageService } from './services/image-storage.service';
import { CURRENT_SCHEMA_VERSION } from './models/storage.model';
import { createDefaultStorageData } from './domain/storage-schema';
import { routes } from './app.routes';

describe('App update notification', () => {
  function setup(isEnabled: boolean | null = true) {
    const versionUpdates = new Subject<VersionEvent>();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
        ...(isEnabled === null
          ? []
          : [{ provide: SwUpdate, useValue: { isEnabled, versionUpdates } }]),
      ],
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, root, versionUpdates };
  }

  it('offers a reload only once the new version is ready to use', () => {
    const { fixture, root, versionUpdates } = setup();
    expect(root.querySelector('[role="status"]')).toBeNull();

    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new-version' } });
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')).toBeNull();

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'current-version' },
      latestVersion: { hash: 'new-version' },
    });
    fixture.detectChanges();

    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      'A new version of Watch List is available.',
    );
    expect(root.querySelector('[role="status"] button')?.textContent?.trim()).toBe('Reload');
  });

  it('reloads the page only when the user clicks Reload', () => {
    const reload = vi.fn();
    TestBed.overrideComponent(App, {
      add: { providers: [{ provide: DOCUMENT, useValue: { location: { reload } } }] },
    });
    const { fixture, root, versionUpdates } = setup();
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'current-version' },
      latestVersion: { hash: 'new-version' },
    });
    fixture.detectChanges();

    expect(reload).not.toHaveBeenCalled();
    const button = root.querySelector<HTMLButtonElement>('[role="status"] button');
    expect(button).not.toBeNull();
    button?.click();

    expect(reload).toHaveBeenCalledOnce();
  });

  it.each([false, null])(
    'keeps the banner hidden when the service worker is disabled or absent (%s)',
    (isEnabled) => {
      const { fixture, root, versionUpdates } = setup(isEnabled);
      versionUpdates.next({
        type: 'VERSION_READY',
        currentVersion: { hash: 'current-version' },
        latestVersion: { hash: 'new-version' },
      });
      fixture.detectChanges();

      expect(root.querySelector('[role="status"]')).toBeNull();
    },
  );

  it('does not offer a reload for failed updates or when no update is available', () => {
    const { fixture, root, versionUpdates } = setup();
    versionUpdates.next({
      type: 'VERSION_INSTALLATION_FAILED',
      version: { hash: 'new-version' },
      error: 'Download failed',
    });
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')).toBeNull();

    versionUpdates.next({
      type: 'NO_NEW_VERSION_DETECTED',
      version: { hash: 'current-version' },
    });
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')).toBeNull();
  });
});

describe('App storage warning', () => {
  afterEach(() => vi.restoreAllMocks());

  it('offers a protected Retry screen for a blocked upgrade and loads the existing collection after retry', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }],
    });
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('watch-list', 2);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('storage');
        request.result.createObjectStore('images', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const original = createDefaultStorageData();
    original.groups['existing'] = { id: 'existing', name: 'Existing collection', order: 1 };
    const transaction = legacy.transaction('storage', 'readwrite');
    transaction.objectStore('storage').put(original, 'watch-list-data');
    await new Promise<void>((resolve) => (transaction.oncomplete = () => resolve()));
    const storage = TestBed.inject(StorageService);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await storage.initialize();
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;

      expect(root.querySelector('main [role="alert"]')?.textContent).toContain(
        'Close other Watch List tabs',
      );
      expect(root.querySelector('router-outlet')).toBeNull();
      expect(root.textContent).not.toContain('Changes are only kept in memory');
      expect(root.querySelector<HTMLButtonElement>('main button')?.textContent?.trim()).toBe(
        'Retry',
      );

      legacy.close();
      expect(await TestBed.inject(ImageStorageService).exportImages()).toEqual([]);
      fixture.detectChanges();
      expect(root.querySelector('router-outlet')).toBeNull();
      expect(root.querySelector<HTMLButtonElement>('main button')?.textContent?.trim()).toBe(
        'Retry',
      );
      root.querySelector<HTMLButtonElement>('main button')?.click();
      fixture.detectChanges();
      expect(root.querySelector('router-outlet')).toBeNull();
      await storage.initialize();
      fixture.detectChanges();

      expect(storage.getData()).toEqual(original);
      expect(root.querySelector('router-outlet')).not.toBeNull();
      expect(root.querySelector('main [role="alert"]')).toBeNull();
    } finally {
      legacy.close();
    }
  });

  it('replaces editable routes with a Reload action when another tab upgrades the database', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }],
    });
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    const reload = vi.fn();
    TestBed.overrideComponent(App, {
      add: { providers: [{ provide: DOCUMENT, useValue: { location: { reload } } }] },
    });
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('router-outlet')).not.toBeNull();

    const future = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('watch-list', 4);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Obsolete connection blocked the upgrade'));
    });
    try {
      fixture.detectChanges();
      expect(root.querySelector('router-outlet')).toBeNull();
      expect(root.querySelector('main [role="alert"]')?.textContent).toContain('Reload Watch List');
      expect(root.textContent).toContain('Collection changes are disabled');
      expect(root.textContent).not.toContain('Download original document');
      expect(root.textContent).not.toContain('was reverted');
      const button = root.querySelector<HTMLButtonElement>('main button');
      expect(button?.textContent?.trim()).toBe('Reload');
      button?.click();
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      future.close();
    }
  });

  it('keeps incompatible collections behind an actionable message and downloads the original document', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: PLATFORM_ID, useValue: 'server' }],
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: new IDBFactory(),
    });
    const initial = TestBed.runInInjectionContext(() => new StorageService());
    await initial.initialize();
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('watch-list');
      request.onsuccess = () => resolve(request.result);
    });
    const raw = {
      ...createDefaultStorageData(),
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      futureSettings: { layout: 'timeline' },
      items: { future: { type: 'interactive', metadata: { chapters: [1, 2] } } },
    };
    const transaction = database.transaction('storage', 'readwrite');
    transaction.objectStore('storage').put(raw, 'watch-list-data');
    await new Promise<void>((resolve) => (transaction.oncomplete = () => resolve()));
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'newer version of Watch List',
    );
    expect(root.textContent).toContain('Collection changes are disabled');
    expect(root.textContent).toContain('does not include locally stored posters');
    expect(root.querySelector('router-outlet')).toBeNull();
    expect(root.textContent).not.toContain('Changes are only kept in memory');
    expect(root.textContent).not.toContain('was reverted');
    for (const path of ['/items/add', '/groups', '/settings']) {
      await TestBed.inject(Router).navigateByUrl(path);
      fixture.detectChanges();
      expect(root.querySelector('router-outlet')).toBeNull();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'newer version of Watch List',
      );
    }

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:original');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const button = root.querySelector<HTMLButtonElement>('main button');
    expect(button?.textContent?.trim()).toBe('Download original document');
    createObjectURL.mockImplementationOnce(() => {
      throw new Error('Download unavailable');
    });
    button?.click();
    fixture.detectChanges();
    expect(root.textContent).toContain(
      'Could not download the original document. Please try again.',
    );
    expect(root.querySelector('router-outlet')).toBeNull();
    button?.click();
    fixture.detectChanges();

    expect(click).toHaveBeenCalledOnce();
    expect(root.textContent).not.toContain('Could not download');
    const blob = createObjectURL.mock.calls[1][0] as Blob;
    const json = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });
    expect(JSON.parse(json)).toEqual(raw);
    await expect(storage.saveData(createDefaultStorageData())).rejects.toThrow(
      /newer version of Watch List/,
    );
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'newer version of Watch List',
    );
    expect(root.querySelector('router-outlet')).toBeNull();
    database.close();
  });

  const unsupportedRecoveryValues = [
    ['Map', () => new Map([['edition', 'extended']])],
    ['Set', () => new Set(['special'])],
    // fake-indexeddb needs Node's cloneable Blob rather than jsdom's Blob.
    [
      'Blob',
      async () => {
        const { Blob } = await vi.importActual<{ Blob: typeof globalThis.Blob }>('node:buffer');
        return new Blob(['future bytes']);
      },
    ],
    ['Date', () => new Date('2026-01-01')],
    ['typed array', () => new Uint8Array([1, 2])],
    ['undefined', () => undefined],
    ['bigint', () => 123n],
    ['non-finite number', () => NaN],
    ['negative zero', () => -0],
    ['sparse array', () => new Array(2)],
    ['array with extra fields', () => Object.assign(['keep'], { future: true })],
    [
      'shared references',
      () => {
        const shared = { keep: true };
        return { first: shared, second: shared };
      },
    ],
    [
      'cycle',
      () => {
        const value: Record<string, unknown> = {};
        value['self'] = value;
        return value;
      },
    ],
  ] satisfies [string, () => unknown][];

  it.each(unsupportedRecoveryValues)(
    'explains why a future document containing %s cannot be downloaded losslessly as JSON',
    async (_, createValue) => {
      TestBed.configureTestingModule({
        providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }],
      });
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: new IDBFactory(),
      });
      const initial = TestBed.runInInjectionContext(() => new StorageService());
      await initial.initialize();
      const database = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('watch-list');
        request.onsuccess = () => resolve(request.result);
      });
      const raw = {
        schemaVersion: CURRENT_SCHEMA_VERSION + 1,
        futureMetadata: await createValue(),
      };
      const transaction = database.transaction('storage', 'readwrite');
      transaction.objectStore('storage').put(raw, 'watch-list-data');
      await new Promise<void>((resolve) => (transaction.oncomplete = () => resolve()));
      const storage = TestBed.inject(StorageService);
      await storage.initialize();
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:lossy');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);

      root.querySelector<HTMLButtonElement>('main button')?.click();
      fixture.detectChanges();

      expect(root.textContent).toContain('cannot be preserved in JSON');
      expect(root.textContent).toContain('No download was created');
      expect(root.textContent).toContain("Keep this app's storage");
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(click).not.toHaveBeenCalled();
      expect(storage.getDataSignal()()).toBeNull();
      expect(storage.getUnsupportedData()).toEqual(structuredClone(raw));
      database.close();
    },
  );

  it('keeps session edits and their warning after edits, imports, and connection recovery', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: new IDBFactory(),
    });
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('Unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }],
    });
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const warning = () => root.querySelector('[role="alert"]')?.textContent;

    expect(warning()).toContain('Changes are only kept in memory and will be lost on reload.');
    expect(warning()).not.toContain('was reverted');

    const edited = storage.getData();
    edited.groups['session'] = { id: 'session', name: 'Session edit', order: 1 };
    await storage.saveData(edited);
    fixture.detectChanges();
    expect(warning()).toContain('will be lost on reload');

    await storage.importDataWithImages(storage.getData(), []);
    fixture.detectChanges();
    expect(warning()).toContain('will be lost on reload');

    const session = storage.getData();
    await storage.initialize();
    fixture.detectChanges();
    expect(storage.getData()).toEqual(session);
    expect(warning()).toContain('will be lost on reload');
  });
});
