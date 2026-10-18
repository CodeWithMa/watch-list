import { TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { StorageService } from '../services/storage.service';
import { WatchListDatabase } from '../services/watch-list-database.service';
import { GroupManagerComponent } from './group-manager/group-manager.component';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { ItemDetailComponent } from './item-detail/item-detail.component';
import { createSuggestionProviders } from '../services/suggestion-search.test-utils';
import { HomeComponent } from './home/home.component';
import { ItemViewComponent } from './item-view/item-view.component';
import { SettingsComponent } from './settings/settings.component';
import { createDefaultStorageData } from '../domain/storage-schema';
import { AddItemComponent } from './add-item/add-item.component';

describe('Conflict recovery interactions', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(window, 'focus').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('preserves a group name through a conflict, refresh, and deliberate retry', async () => {
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    const external = Injector.create({ providers: [StorageService, WatchListDatabase] }).get(
      StorageService,
    );
    await external.initialize();
    const fixture = TestBed.createComponent(GroupManagerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('[name="newGroupName"]')!;
    input.value = 'My draft group';
    input.dispatchEvent(new Event('input'));
    await external.mutate((draft) => {
      draft.groups['ungrouped'].name = 'External group';
    });
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('changed in another tab or window');
    });
    const get = IDBObjectStore.prototype.get;
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementationOnce(function (
      this: IDBObjectStore,
      key,
    ) {
      const request = get.call(this, key);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    button(root, 'Refresh collection').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('Failed to read collection');
    });
    expect(input.value).toBe('My draft group');
    expect(storage.getConflictSignal()()).toBe(true);
    expect(storage.getInMemorySessionSignal()()).toBe(false);
    expect(storage.getGroups()[0].name).toBe('Ungrouped');
    button(root, 'Refresh collection').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('External group');
    });
    expect(input.value).toBe('My draft group');
    expect(storage.getGroups()).toHaveLength(1);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() =>
      expect(storage.getGroups().map((group) => group.name)).toEqual([
        'External group',
        'My draft group',
      ]),
    );
  });

  it('keeps an edit draft mounted across refresh and preserves the other window’s watch changes on retry', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'series' })) },
        },
        ...createSuggestionProviders().providers,
      ],
    });
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    await storage.mutate((draft) => {
      draft.items['series'] = {
        id: 'series',
        title: 'Original series',
        type: 'series',
        status: 'in-progress',
        groupId: 'ungrouped',
        createdAt: '2026-01-01',
        isAdult: false,
        watchHistory: [],
        progress: { season: 1, episode: 1, seasons: [{ seasonNumber: 1, totalEpisodes: 10 }] },
      };
    });
    const external = Injector.create({ providers: [StorageService, WatchListDatabase] }).get(
      StorageService,
    );
    await external.initialize();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ItemDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const title = root.querySelector<HTMLInputElement>('#title')!;
    title.value = 'My unsaved title';
    title.dispatchEvent(new Event('input'));
    await external.mutate((draft) => {
      draft.items['series'].progress!.episode = 2;
      draft.items['series'].watchHistory.push({
        season: 1,
        episode: 1,
        date: '2026-10-18T12:00:00.000Z',
      });
    });
    const submit = () =>
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    submit();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('changed in another tab or window');
    });
    expect(navigate).not.toHaveBeenCalled();
    button(root, 'Refresh collection').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('Collection refreshed');
    });
    expect(root.querySelector('#title')).toBe(title);
    expect(title.value).toBe('My unsaved title');
    submit();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());
    expect(storage.getData().items['series']).toMatchObject({
      title: 'My unsaved title',
      progress: { episode: 2 },
      watchHistory: [{ episode: 1 }],
    });
  });

  it.each([
    { name: 'Home', component: HomeComponent },
    { name: 'Item view', component: ItemViewComponent },
  ])('refreshes $name watch actions before a deliberate retry', async ({ component }) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'series' })) },
        },
      ],
    });
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    await storage.mutate((draft) => {
      draft.items['series'] = {
        id: 'series',
        title: 'Series',
        type: 'series',
        status: 'in-progress',
        groupId: 'ungrouped',
        createdAt: '2026-01-01',
        isAdult: false,
        watchHistory: [],
        progress: { season: 1, episode: 1, seasons: [{ seasonNumber: 1, totalEpisodes: 10 }] },
      };
    });
    const external = Injector.create({ providers: [StorageService, WatchListDatabase] }).get(
      StorageService,
    );
    await external.initialize();
    const fixture = TestBed.createComponent<HomeComponent | ItemViewComponent>(component);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    await external.mutate((draft) => {
      draft.items['series'].title = 'Renamed externally';
    });
    button(root, 'Mark Watched').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('changed in another tab or window');
    });
    expect(storage.getData().items['series'].watchHistory).toHaveLength(0);
    button(root, 'Refresh collection').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('Renamed externally');
    });
    expect(storage.getData().items['series'].watchHistory).toHaveLength(0);
    button(root, 'Mark Watched').click();
    await vi.waitFor(() => expect(storage.getData().items['series'].watchHistory).toHaveLength(1));
    expect(storage.getData().items['series'].progress?.episode).toBe(2);
  });

  it('retains the selected import for refresh, review, and reconfirmation after conflict', async () => {
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    const external = Injector.create({ providers: [StorageService, WatchListDatabase] }).get(
      StorageService,
    );
    await external.initialize();
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const data = createDefaultStorageData();
    data.groups['ungrouped'].name = 'Imported group';
    const file = { name: 'collection.json', text: async () => JSON.stringify(data) } as File;
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await external.mutate((draft) => {
      draft.groups['ungrouped'].name = 'External group';
    });
    button(root, 'Confirm Import').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('Import failed');
    });
    expect(root.textContent).toContain('collection.json');
    button(root, 'Refresh collection').click();
    fixture.detectChanges();
    expect(button(root, 'Confirm Import').disabled).toBe(true);
    button(root, 'Confirm Import').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('Collection refreshed');
    });
    expect(storage.getGroups()[0].name).toBe('External group');
    expect(root.textContent).toContain('collection.json');
    button(root, 'Confirm Import').click();
    await vi.waitFor(() => expect(storage.getGroups()[0].name).toBe('Imported group'));
  });

  it('keeps an add-item draft across refresh without replaying the rejected creation', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...createSuggestionProviders().providers],
    });
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    const external = Injector.create({ providers: [StorageService, WatchListDatabase] }).get(
      StorageService,
    );
    await external.initialize();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AddItemComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const title = root.querySelector<HTMLInputElement>('#title')!;
    title.value = 'New movie draft';
    title.dispatchEvent(new Event('input'));
    await external.mutate((draft) => {
      draft.groups['ungrouped'].name = 'External group';
    });
    const submit = () =>
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    submit();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('changed in another tab or window');
    });
    expect(navigate).not.toHaveBeenCalled();
    button(root, 'Refresh collection').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('Collection refreshed');
    });
    expect(title.value).toBe('New movie draft');
    expect(storage.getItems()).toEqual([]);
    submit();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());
    expect(storage.getItems()).toMatchObject([{ title: 'New movie draft' }]);
    expect(storage.getGroups()[0].name).toBe('External group');
  });

  it('keeps group editing and its draft open when refresh reveals the group was deleted', async () => {
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    await storage.mutate((draft) => {
      draft.groups['films'] = { id: 'films', name: 'Films', order: 1 };
    });
    const external = Injector.create({ providers: [StorageService, WatchListDatabase] }).get(
      StorageService,
    );
    await external.initialize();
    const fixture = TestBed.createComponent(GroupManagerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    button(root, 'Edit').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const name = root.querySelector<HTMLInputElement>('[name="editGroupName"]')!;
    name.value = 'My rename';
    name.dispatchEvent(new Event('input'));
    await external.mutate((draft) => {
      delete draft.groups['films'];
    });
    button(root, 'Save').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('changed in another tab or window');
    });
    button(root, 'Refresh collection').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('Collection refreshed');
    });
    expect(name.value).toBe('My rename');
    button(root, 'Save').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('no longer exists');
    });
    expect(name.value).toBe('My rename');
    expect(storage.getGroups()).toHaveLength(1);
  });
});

function button(root: HTMLElement, label: string) {
  const found = [...root.querySelectorAll('button')].find(
    (control) => control.textContent?.trim() === label,
  );
  expect(found, label).toBeDefined();
  return found!;
}
