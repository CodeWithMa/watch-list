import { DOCUMENT, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { IDBFactory } from 'fake-indexeddb';
import { Subject } from 'rxjs';
import { afterEach, vi } from 'vitest';
import { App } from './app';
import { StorageService } from './services/storage.service';
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

  it('keeps incompatible collections behind an actionable message and downloads the original document', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: new IDBFactory(),
    });
    const initial = new StorageService();
    await initial.initialize();
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('watch-list', 2);
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
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: PLATFORM_ID, useValue: 'server' }],
    });
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'newer version of Watch List',
    );
    expect(root.textContent).toContain('Collection changes are disabled');
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

  it('keeps the session-only warning visible after edits and imports until storage recovers', async () => {
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

    await storage.saveData(storage.getData());
    fixture.detectChanges();
    expect(warning()).toContain('will be lost on reload');

    await storage.importDataWithImages(storage.getData(), []);
    fixture.detectChanges();
    expect(warning()).toContain('will be lost on reload');

    await storage.initialize();
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });
});
