import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { StorageService } from './services/storage.service';
import { ThemeService } from './services/theme.service';
import { ItemSortService } from './services/item-sort.service';
import { ProviderSettingsService } from './services/provider-settings.service';
import { ImageStorageService } from './services/image-storage.service';

describe('storage fault screen journeys', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['indexedDB', 'localStorage', 'both', 'images', 'images and localStorage'])(
    'keeps core screens usable with unavailable %s and reports failed credential persistence',
    async (fault) => {
      vi.stubGlobal('indexedDB', new IDBFactory());
      vi.stubGlobal('matchMedia', () => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const session = fault === 'indexedDB' || fault === 'both';
      const settingsUnavailable = fault.includes('localStorage') || fault === 'both';
      if (session)
        vi.spyOn(indexedDB, 'open').mockImplementation(() => {
          throw new Error('No IndexedDB');
        });
      if (settingsUnavailable)
        vi.stubGlobal('localStorage', {
          getItem: () => {
            throw new DOMException('Denied', 'SecurityError');
          },
          setItem: () => {
            throw new DOMException('Full', 'QuotaExceededError');
          },
          removeItem: () => {
            throw new DOMException('Denied', 'SecurityError');
          },
        });
      if (fault.includes('images')) {
        const get = IDBObjectStore.prototype.get;
        vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (
          this: IDBObjectStore,
          key,
        ) {
          if (this.name === 'images') throw new Error('Images unavailable');
          return get.call(this, key);
        });
      }
      TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
      const storage = TestBed.inject(StorageService);
      await storage.initialize();
      await storage.mutate((draft) => {
        draft.items['movie'] = {
          id: 'movie',
          title: 'Session movie',
          type: 'movie',
          groupId: 'ungrouped',
          status: 'not-started',
          isAdult: false,
          createdAt: '2026-01-01',
          watchHistory: [],
          posterId: 'missing',
        };
      });
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const router = TestBed.inject(Router);
      for (const path of [
        '/',
        '/items',
        '/items/movie',
        '/items/movie/edit',
        '/items/add',
        '/groups',
        '/settings',
      ]) {
        await router.navigateByUrl(path);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(root.querySelector('main h1, main h2'), path).not.toBeNull();
        expect(root.textContent?.includes('Changes are only kept in memory'), path).toBe(session);
      }
      await TestBed.inject(ImageStorageService)
        .getUrl('missing')
        .catch(() => null);
      fixture.detectChanges();
      expect(root.textContent).toContain('Some posters are unavailable');
      TestBed.inject(ThemeService).setTheme('dark');
      TestBed.inject(ItemSortService).setField('title');
      TestBed.inject(ProviderSettingsService).setEnabled('jikan', false);
      fixture.detectChanges();
      expect(TestBed.inject(ThemeService).theme()).toBe('dark');
      expect(TestBed.inject(ItemSortService).field()).toBe('title');
      expect(TestBed.inject(ProviderSettingsService).isEnabled('jikan')).toBe(false);
      if (session) {
        await storage.importDataWithImages(storage.getData(), []);
        fixture.detectChanges();
        expect(root.textContent).toContain('Changes are only kept in memory');
        expect(root.querySelector('main h1')?.textContent).toBe('Settings');
      }
      if (settingsUnavailable) {
        expect(root.textContent).toContain('Browser settings storage is unavailable');
        const token = root.querySelector<HTMLInputElement>('#tmdbToken')!;
        token.value = 'session-token';
        token.dispatchEvent(new Event('input'));
        const save = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
          b.textContent?.includes('Save Credentials'),
        )!;
        save.click();
        fixture.detectChanges();
        expect(root.textContent).toContain('could not be saved');
        expect(root.textContent).not.toContain('token saved');
        const clear = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
          b.textContent?.includes('Clear Credentials'),
        )!;
        clear.click();
        fixture.detectChanges();
        expect(root.textContent).toContain('Stored credentials could not all be removed');
        expect(root.textContent).not.toContain('TMDB credentials cleared.');
      }
    },
  );
});
