import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { routes } from '../app.routes';
import { StorageService } from '../services/storage.service';
import { ImageStorageService } from '../services/image-storage.service';
import { holdStorageWrite } from '../services/indexeddb-write.test-utils';
import { createSuggestionProviders } from '../services/suggestion-search.test-utils';
import { AddItemComponent } from './add-item/add-item.component';
import { ItemDetailComponent } from './item-detail/item-detail.component';

describe('Item form navigation with pending saves', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['add', 'edit'] as const)(
    'keeps the %s form and its uploaded poster alive until the collection commits',
    async (mode) => {
      const { storage, router, harness, path, screen, root } = await openForm(mode);

      const held = holdStorageWrite(0);
      let navigationAllowed: boolean | undefined;
      let pathDuringSave: string | undefined;
      let formRetained: boolean | undefined;
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      try {
        await held.started;
        navigationAllowed = await router.navigateByUrl('/items');
        pathDuringSave = router.url;
        formRetained = harness.routeNativeElement === root;
      } finally {
        held.release();
      }
      await vi.waitFor(() => expect(screen.mutation.busy()).toBe(false));
      await harness.fixture.whenStable();
      const reloaded = TestBed.runInInjectionContext(() => new StorageService());
      await reloaded.initialize();
      const saved = reloaded.getItems().find((item) => item.title === 'Saved with poster')!;
      const images = TestBed.runInInjectionContext(() => new ImageStorageService());
      const poster = await images.getUrl(saved.posterId);
      expect({ navigationAllowed, pathDuringSave, formRetained, poster }).toEqual({
        navigationAllowed: false,
        pathDuringSave: path,
        formRetained: true,
        poster: 'blob:uploaded-poster',
      });
      expect(router.url).toBe('/items');
      expect(reloaded.getData()).toEqual(storage.getData());
    },
  );

  it.each(['add', 'edit'] as const)(
    'unlocks a rejected %s save and retains its uploaded poster for retry',
    async (mode) => {
      const { storage, router, harness, path, screen, root } = await openForm(mode);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const held = holdStorageWrite(0);
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      try {
        await held.started;
        expect(await router.navigateByUrl('/groups')).toBe(false);
        expect(router.url).toBe(path);
        expect(harness.routeNativeElement).toBe(root);
      } finally {
        held.abort();
      }
      await vi.waitFor(() => {
        harness.detectChanges();
        expect(screen.mutation.busy()).toBe(false);
        expect(root.querySelector('[role="alert"]')?.textContent).toContain('Please try again');
      });
      expect(root.querySelector<HTMLInputElement>('#title')?.value).toBe('Saved with poster');
      expect(root.querySelector('img[src="blob:uploaded-poster"]')).not.toBeNull();
      expect(storage.getItems().find((item) => item.title === 'Saved with poster')).toBeUndefined();
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await vi.waitFor(() => expect(router.url).toBe('/items'));
      await harness.fixture.whenStable();
      const reloaded = TestBed.runInInjectionContext(() => new StorageService());
      await reloaded.initialize();
      const saved = reloaded.getItems().find((item) => item.title === 'Saved with poster')!;
      const images = TestBed.runInInjectionContext(() => new ImageStorageService());
      expect(await images.getUrl(saved.posterId)).toBe('blob:uploaded-poster');
      expect(reloaded.getData()).toEqual(storage.getData());
    },
  );

  it.each(['add', 'edit'] as const)('allows leaving an idle %s form', async (mode) => {
    const { router, harness } = await openForm(mode);
    expect(await router.navigateByUrl('/items')).toBe(true);
    expect(router.url).toBe('/items');
    await harness.fixture.whenStable();
  });

  it('retains the original edit draft when edit-to-edit navigation is attempted before a save rejects', async () => {
    const { storage, router, harness, path, screen, root } = await openForm('edit');
    await addOtherItem(storage);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const held = holdStorageWrite(0);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    try {
      await held.started;
      expect(await router.navigateByUrl('/items/other/edit')).toBe(false);
      expect(router.url).toBe(path);
      expect(harness.routeNativeElement).toBe(root);
      expect(root.querySelector<HTMLInputElement>('#title')?.value).toBe('Saved with poster');
    } finally {
      held.abort();
    }
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(screen.mutation.busy()).toBe(false);
      expect(root.querySelector('[role="alert"]')?.textContent).toContain('Please try again');
    });
    expect(root.querySelector<HTMLInputElement>('#title')?.value).toBe('Saved with poster');
    expect(root.querySelector('img[src="blob:uploaded-poster"]')).not.toBeNull();
    expect(storage.getData().items['series'].title).toBe('Series');
    expect(storage.getData().items['other'].title).toBe('Other item');
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(router.url).toBe('/items'));
    await harness.fixture.whenStable();
    const reloaded = TestBed.runInInjectionContext(() => new StorageService());
    await reloaded.initialize();
    const saved = reloaded.getData().items['series'];
    expect(saved.title).toBe('Saved with poster');
    expect(reloaded.getData().items['other'].title).toBe('Other item');
    const images = TestBed.runInInjectionContext(() => new ImageStorageService());
    expect(await images.getUrl(saved.posterId)).toBe('blob:uploaded-poster');
    expect(reloaded.getData()).toEqual(storage.getData());
  });

  it('reuses the idle edit component and opens the other item when its route parameter changes', async () => {
    const { storage, router, harness, screen, root } = await openForm('edit');
    await addOtherItem(storage);
    const next = await harness.navigateByUrl('/items/other/edit', ItemDetailComponent);
    expect(next).toBe(screen);
    expect(harness.routeNativeElement).toBe(root);
    expect(router.url).toBe('/items/other/edit');
    expect(next.item()?.id).toBe('other');
    expect(root.querySelector<HTMLInputElement>('#title')?.value).toBe('Other item');
  });
});

async function addOtherItem(storage: StorageService) {
  const data = storage.getData();
  await storage.saveData({
    ...data,
    items: { ...data.items, other: { ...data.items['series'], id: 'other', title: 'Other item' } },
  });
}

async function openForm(mode: 'add' | 'edit') {
  const context = await setup();
  const { harness } = context;
  const path = mode === 'add' ? '/items/add' : '/items/series/edit';
  const screen =
    mode === 'add'
      ? await harness.navigateByUrl(path, AddItemComponent)
      : await harness.navigateByUrl(path, ItemDetailComponent);
  const root = harness.routeNativeElement!;
  const title = root.querySelector<HTMLInputElement>('#title')!;
  title.value = 'Saved with poster';
  title.dispatchEvent(new Event('input'));
  const upload = root.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(upload, 'files', {
    value: [new File(['image'], 'poster.png', { type: 'image/png' })],
  });
  upload.dispatchEvent(new Event('change'));
  await vi.waitFor(() => {
    harness.detectChanges();
    expect(root.querySelector('img[src="blob:uploaded-poster"]')).not.toBeNull();
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });
  return { ...context, path, screen, root };
}

async function setup() {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  vi.stubGlobal('createImageBitmap', async () => ({
    close() {
      /* native image decoder boundary */
    },
  }));
  vi.stubGlobal(
    'URL',
    class extends URL {
      static override createObjectURL() {
        return 'blob:uploaded-poster';
      }
      static override revokeObjectURL() {
        /* native object URL boundary */
      }
    },
  );
  TestBed.configureTestingModule({
    providers: [provideRouter(routes), ...createSuggestionProviders().providers],
  });
  const storage = TestBed.inject(StorageService);
  await storage.initialize();
  await storage.saveData({
    ...storage.getData(),
    items: {
      series: {
        id: 'series',
        title: 'Series',
        type: 'series',
        groupId: 'ungrouped',
        status: 'not-started',
        isAdult: false,
        createdAt: '2026-01-01',
        watchHistory: [],
        progress: { season: 1, episode: 1, seasons: [] },
      },
    },
  });
  const router = TestBed.inject(Router);
  const harness = await RouterTestingHarness.create();
  return { storage, router, harness };
}
