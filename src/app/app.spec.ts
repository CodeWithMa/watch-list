import { DOCUMENT, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { IDBFactory } from 'fake-indexeddb';
import { Subject } from 'rxjs';
import { afterEach, vi } from 'vitest';
import { App } from './app';
import { StorageService } from './services/storage.service';

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
