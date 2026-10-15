import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { App } from './app';
import { StorageService } from './services/storage.service';

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
