import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { StorageService } from '../services/storage.service';
import { WatchListService } from '../services/watch-list.service';
import { controlStorageWrites, holdStorageWrite } from '../services/indexeddb-write.test-utils';
import { createSuggestionProviders } from '../services/suggestion-search.test-utils';
import { AddItemComponent } from './add-item/add-item.component';
import { ItemDetailComponent } from './item-detail/item-detail.component';
import { GroupService } from '../services/group.service';
import { ImageStorageService } from '../services/image-storage.service';

describe('Settled item form interactions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps failed creation input and exposes a retry without navigation or duplicate additions', async () => {
    const { storage, navigate } = await setup();
    const fixture = TestBed.createComponent(AddItemComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const title = root.querySelector<HTMLInputElement>('#title')!;
    title.value = '  Retry movie  ';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const form = root.querySelector('form')!;
    controlStorageWrites([false]);
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain('Please try again');
    });
    expect(title.value).toBe('  Retry movie  ');
    expect(navigate).not.toHaveBeenCalled();
    expect(storage.getItems()).toEqual([]);
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith(['/items']));
    expect(storage.getItems()).toMatchObject([{ title: 'Retry movie' }]);
  });

  it('retains the open edit draft across watch changes and saves only its changed fields', async () => {
    const { storage, watch, navigate } = await setup();
    await seedSeries(storage);
    const fixture = TestBed.createComponent(ItemDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const title = root.querySelector<HTMLInputElement>('#title')!;
    title.value = 'My edit';
    title.dispatchEvent(new Event('input'));
    await watch.markWatched('series');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(title.value).toBe('My edit');
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith(['/items']));
    expect(watch.getItemById('series')).toMatchObject({
      title: 'My edit',
      status: 'in-progress',
      progress: { episode: 2 },
      watchHistory: [{ season: 1, episode: 1 }],
    });
  });

  it.each(['save', 'delete'] as const)(
    'recovers a rejected %s without losing edit input',
    async (command) => {
      const { storage, navigate } = await setup();
      await seedSeries(storage);
      const fixture = TestBed.createComponent(ItemDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const title = root.querySelector<HTMLInputElement>('#title')!;
      title.value = 'Retained draft';
      title.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      if (command === 'delete') {
        button(root, 'Delete').click();
        fixture.detectChanges();
      }
      const submit = () =>
        command === 'save'
          ? root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
          : button(root, 'Confirm Delete?').click();
      controlStorageWrites([false]);
      submit();
      submit();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(root.querySelector('[role="alert"]')?.textContent).toContain(`Unable to ${command}`);
      });
      expect(navigate).not.toHaveBeenCalled();
      expect(storage.getData().items['series'].title).toBe('Series');
      expect(title.value).toBe('Retained draft');
      expect(fixture.componentInstance.mutation.busy()).toBe(false);
      submit();
      await vi.waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith(['/items']));
      expect(storage.getData().items['series']?.title).toBe(
        command === 'save' ? 'Retained draft' : undefined,
      );
      await expectReload(storage);
    },
  );

  it.each(['add', 'save', 'delete'] as const)(
    'locks %s controls and navigates only after the transaction completes',
    async (command) => {
      const { storage, navigate } = await setup();
      await seedSeries(storage);
      const fixture =
        command === 'add'
          ? TestBed.createComponent(AddItemComponent)
          : TestBed.createComponent(ItemDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const title = root.querySelector<HTMLInputElement>('#title')!;
      title.value = 'Pending title';
      title.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      if (command === 'delete') {
        button(root, 'Delete').click();
        fixture.detectChanges();
      }
      const held = holdStorageWrite(0);
      const submit = () =>
        command === 'delete'
          ? button(root, 'Confirm Delete?').click()
          : root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      submit();
      try {
        await held.started;
        fixture.detectChanges();
        expect(root.querySelector('fieldset')?.disabled).toBe(true);
        expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
        expect(navigate).not.toHaveBeenCalled();
        expect(storage.getData().items['series'].title).toBe('Series');
        submit();
        if (command !== 'add') {
          for (const control of root.querySelectorAll<HTMLButtonElement>('button')) {
            if (control.textContent?.includes('Delete')) expect(control.disabled).toBe(true);
          }
        }
      } finally {
        held.release();
      }
      await vi.waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith(['/items']));
      expect(storage.getItems()).toHaveLength(command === 'add' ? 2 : command === 'delete' ? 0 : 1);
      await expectReload(storage);
    },
  );

  it('keeps a deleted-item draft intelligible and never recreates it on save', async () => {
    const { storage, watch, navigate } = await setup();
    await seedSeries(storage);
    const fixture = TestBed.createComponent(ItemDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const title = root.querySelector<HTMLInputElement>('#title')!;
    title.value = 'Unsaved input';
    title.dispatchEvent(new Event('input'));
    await watch.deleteItem('series');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(title.value).toBe('Unsaved input');
    expect(root.textContent).toContain('deleted while you were editing');
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('no longer exists');
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(watch.items()).toEqual([]);
    expect(fixture.componentInstance.mutation.busy()).toBe(false);
    await expectReload(storage);
  });

  it('retains a draft across group removal and saves to Ungrouped', async () => {
    const { storage, watch, navigate } = await setup();
    await seedSeries(storage);
    const groups = TestBed.inject(GroupService);
    const group = (await groups.createGroup('Temporary')).value;
    await watch.updateItem('series', { groupId: group.id });
    const fixture = TestBed.createComponent(ItemDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const title = root.querySelector<HTMLInputElement>('#title')!;
    title.value = 'Edited after removal';
    title.dispatchEvent(new Event('input'));
    await groups.deleteGroup(group.id);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(title.value).toBe('Edited after removal');
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith(['/items']));
    expect(watch.getItemById('series')).toMatchObject({
      title: 'Edited after removal',
      groupId: 'ungrouped',
    });
    await expectReload(storage);
  });

  it.each(['add', 'save'] as const)(
    'retains an uploaded draft poster after failed %s and retries with it',
    async (command) => {
      vi.stubGlobal('createImageBitmap', async () => ({
        close() {
          /* native image decoder boundary */
        },
      }));
      vi.stubGlobal(
        'URL',
        class extends URL {
          static override createObjectURL() {
            return 'blob:draft-poster';
          }
          static override revokeObjectURL() {
            /* native object URL boundary */
          }
        },
      );
      const { storage, navigate } = await setup();
      if (command === 'save') await seedSeries(storage);
      const fixture =
        command === 'add'
          ? TestBed.createComponent(AddItemComponent)
          : TestBed.createComponent(ItemDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const title = root.querySelector<HTMLInputElement>('#title')!;
      title.value = 'With poster';
      title.dispatchEvent(new Event('input'));
      const upload = root.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(upload, 'files', {
        value: [new File(['image'], 'poster.png', { type: 'image/png' })],
      });
      upload.dispatchEvent(new Event('change'));
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(root.querySelector('img[src="blob:draft-poster"]')).not.toBeNull();
        expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(
          false,
        );
      });
      controlStorageWrites([false]);
      const form = root.querySelector('form')!;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(root.querySelector('[role="alert"]')?.textContent).toContain('Please try again');
      });
      expect(root.querySelector('img[src="blob:draft-poster"]')).not.toBeNull();
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await vi.waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith(['/items']));
      const saved = storage.getItems().find((item) => item.title === 'With poster')!;
      expect(saved.posterId).toMatch(/^image-/);
      expect(await TestBed.inject(ImageStorageService).getUrl(saved.posterId)).toBe(
        'blob:draft-poster',
      );
      await expectReload(storage);
    },
  );
});

async function setup() {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap({ id: 'series' }) },
          paramMap: of(convertToParamMap({ id: 'series' })),
        },
      },
      ...createSuggestionProviders().providers,
    ],
  });
  const storage = TestBed.inject(StorageService);
  const watch = TestBed.inject(WatchListService);
  await storage.initialize();
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  return { storage, watch, navigate };
}

function button(root: HTMLElement, label: string) {
  return [...root.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === label,
  )!;
}

async function expectReload(storage: StorageService) {
  const reloaded = TestBed.runInInjectionContext(() => new StorageService());
  await reloaded.initialize();
  expect(reloaded.getData()).toEqual(storage.getData());
}

async function seedSeries(storage: StorageService) {
  await storage.saveData({
    ...storage.getData(),
    items: {
      series: {
        id: 'series',
        title: 'Series',
        type: 'series',
        status: 'not-started',
        groupId: 'ungrouped',
        createdAt: '2026-01-01',
        isAdult: false,
        watchHistory: [],
        progress: { season: 1, episode: 1, seasons: [{ seasonNumber: 1, totalEpisodes: 10 }] },
      },
    },
  });
}
