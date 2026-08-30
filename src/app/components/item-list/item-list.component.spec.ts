import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Item } from '../../models/item.model';
import { Group } from '../../models/group.model';
import { GroupService } from '../../services/group.service';
import { WatchListService } from '../../services/watch-list.service';
import { ImageStorageService } from '../../services/image-storage.service';
import { ItemListComponent } from './item-list.component';

function createItem(overrides: Partial<Item> & Pick<Item, 'id' | 'title'>): Item {
  return {
    type: 'series',
    groupId: 'ungrouped',
    status: 'not-started',
    isAdult: false,
    watchHistory: [],
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  } as Item;
}

function createGroup(overrides: Partial<Group> & Pick<Group, 'id' | 'name'>): Group {
  return {
    order: 0,
    ...overrides,
  } as Group;
}

describe('ItemListComponent', () => {
  const mockGroups: Group[] = [
    createGroup({ id: 'ungrouped', name: 'Ungrouped', order: 0 }),
    createGroup({ id: 'g1', name: 'Group 1', order: 1 }),
  ];

  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        clear() {
          for (const key of Object.keys(store)) delete store[key];
        },
        getItem(key: string) {
          return store[key] ?? null;
        },
        setItem(key: string, value: string) {
          store[key] = value;
        },
        removeItem(key: string) {
          delete store[key];
        },
      },
      writable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: window.localStorage,
      writable: true,
    });
  });

  function setup({
    watchItems = [],
    groups = mockGroups,
    sortField = 'createdAt' as const,
    sortDirection = 'desc' as const,
  }: {
    watchItems?: Item[];
    groups?: Group[];
    sortField?: 'title' | 'createdAt' | 'lastWatched';
    sortDirection?: 'asc' | 'desc';
  } = {}) {
    window.localStorage.clear();
    window.localStorage.setItem('itemSortField', sortField);
    window.localStorage.setItem('itemSortDirection', sortDirection);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: WatchListService,
          useValue: {
            items: signal(watchItems),
          },
        },
        {
          provide: GroupService,
          useValue: {
            groups: signal(groups).asReadonly(),
          },
        },
        {
          provide: ImageStorageService,
          useValue: {
            version: signal(0).asReadonly(),
            getUrl: vi.fn(() => Promise.resolve(null)),
          },
        },
      ],
    });
  }

  afterEach(() => {
    store = {};
    window.localStorage.clear();
  });

  it('defaults to createdAt desc sorting (newest first)', () => {
    const items = [
      createItem({ id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00.000Z' }),
      createItem({ id: 'b', title: 'B', createdAt: '2026-03-01T00:00:00.000Z' }),
      createItem({ id: 'c', title: 'C', createdAt: '2026-02-01T00:00:00.000Z' }),
    ];
    setup({ watchItems: items });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredItems().map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by title ascending', () => {
    const items = [
      createItem({ id: 'c', title: 'Cherry' }),
      createItem({ id: 'a', title: 'Apple' }),
      createItem({ id: 'b', title: 'Banana' }),
    ];
    setup({ watchItems: items, sortField: 'title', sortDirection: 'asc' });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredItems().map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by title descending', () => {
    const items = [
      createItem({ id: 'a', title: 'Apple' }),
      createItem({ id: 'b', title: 'Banana' }),
      createItem({ id: 'c', title: 'Cherry' }),
    ];
    setup({ watchItems: items, sortField: 'title', sortDirection: 'desc' });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredItems().map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });

  it('sorts by title case-insensitive', () => {
    const items = [
      createItem({ id: 'b', title: 'banana' }),
      createItem({ id: 'a', title: 'Apple' }),
      createItem({ id: 'c', title: 'cherry' }),
    ];
    setup({ watchItems: items, sortField: 'title', sortDirection: 'asc' });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredItems().map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by createdAt ascending', () => {
    const items = [
      createItem({ id: 'b', title: 'B', createdAt: '2026-02-01T00:00:00.000Z' }),
      createItem({ id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00.000Z' }),
      createItem({ id: 'c', title: 'C', createdAt: '2026-03-01T00:00:00.000Z' }),
    ];
    setup({ watchItems: items, sortField: 'createdAt', sortDirection: 'asc' });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredItems().map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by lastWatched ascending', () => {
    const items = [
      createItem({
        id: 'b',
        title: 'B',
        watchHistory: [{ date: '2026-05-01T00:00:00.000Z' }],
      }),
      createItem({
        id: 'a',
        title: 'A',
        watchHistory: [{ date: '2026-01-01T00:00:00.000Z' }],
      }),
      createItem({
        id: 'c',
        title: 'C',
        watchHistory: [{ date: '2026-03-01T00:00:00.000Z' }],
      }),
    ];
    setup({ watchItems: items, sortField: 'lastWatched', sortDirection: 'asc' });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredItems().map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts by lastWatched descending', () => {
    const items = [
      createItem({
        id: 'a',
        title: 'A',
        watchHistory: [{ date: '2026-01-01T00:00:00.000Z' }],
      }),
      createItem({
        id: 'b',
        title: 'B',
        watchHistory: [{ date: '2026-05-01T00:00:00.000Z' }],
      }),
      createItem({
        id: 'c',
        title: 'C',
        watchHistory: [{ date: '2026-03-01T00:00:00.000Z' }],
      }),
    ];
    setup({ watchItems: items, sortField: 'lastWatched', sortDirection: 'desc' });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredItems().map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('falls back to createdAt for lastWatched when no history', () => {
    const items = [
      createItem({ id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00.000Z', watchHistory: [] }),
      createItem({ id: 'b', title: 'B', createdAt: '2026-03-01T00:00:00.000Z', watchHistory: [] }),
      createItem({
        id: 'c',
        title: 'C',
        watchHistory: [{ date: '2026-02-01T00:00:00.000Z' }],
      }),
    ];
    setup({ watchItems: items, sortField: 'lastWatched', sortDirection: 'asc' });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    // a: 2026-01-01, c: 2026-02-01, b: 2026-03-01
    expect(fixture.componentInstance.filteredItems().map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('applies filters before sorting', () => {
    const items = [
      createItem({ id: 'a', title: 'Apple', status: 'completed', isAdult: false }),
      createItem({ id: 'b', title: 'Banana', status: 'not-started', isAdult: false }),
      createItem({ id: 'c', title: 'Cherry', status: 'not-started', isAdult: false }),
    ];
    setup({ watchItems: items, sortField: 'title', sortDirection: 'asc' });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    const instance = fixture.componentInstance;
    instance.statusFilter.set('not-started');
    fixture.detectChanges();
    expect(instance.filteredItems().map((i) => i.id)).toEqual(['b', 'c']);
  });

  it('filters by search then sorts', () => {
    const items = [
      createItem({ id: 'a', title: 'Naruto' }),
      createItem({ id: 'b', title: 'Bleach' }),
      createItem({ id: 'c', title: 'Naruto Shippuden' }),
    ];
    setup({ watchItems: items, sortField: 'title', sortDirection: 'asc' });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    const instance = fixture.componentInstance;
    instance.searchFilter.set('naruto');
    fixture.detectChanges();
    expect(instance.filteredItems().map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('filters by group then sorts', () => {
    const items = [
      createItem({ id: 'a', title: 'B Title', groupId: 'g1' }),
      createItem({ id: 'b', title: 'A Title', groupId: 'ungrouped' }),
      createItem({ id: 'c', title: 'C Title', groupId: 'g1' }),
    ];
    setup({ watchItems: items, sortField: 'title', sortDirection: 'asc' });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    const instance = fixture.componentInstance;
    instance.groupFilter.set('g1');
    fixture.detectChanges();
    expect(instance.filteredItems().map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('setSortField updates signal and persists', () => {
    setup({ watchItems: [] });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    const instance = fixture.componentInstance;
    instance.setSortField('title');
    expect(instance.sortField()).toBe('title');
    expect(window.localStorage.getItem('itemSortField')).toBe('title');
  });

  it('setSortDirection updates signal and persists', () => {
    setup({ watchItems: [] });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    const instance = fixture.componentInstance;
    instance.setSortDirection('asc');
    expect(instance.sortDirection()).toBe('asc');
    expect(window.localStorage.getItem('itemSortDirection')).toBe('asc');
  });

  it('initializes from persisted ItemSortService values', () => {
    setup({ watchItems: [], sortField: 'lastWatched', sortDirection: 'asc' });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.sortField()).toBe('lastWatched');
    expect(fixture.componentInstance.sortDirection()).toBe('asc');
  });

  it('renders sort controls', async () => {
    setup({ watchItems: [] });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const selects = fixture.nativeElement.querySelectorAll('select');
    // group + sortField = 2 selects, sort direction is now a toggle button
    expect(selects.length).toBe(2);

    const sortBySelect = fixture.nativeElement.querySelector('select[aria-label="Sort by"]');
    expect(sortBySelect).not.toBeNull();
    expect(sortBySelect.textContent).toContain('Title');
    expect(sortBySelect.textContent).toContain('Added date');
    expect(sortBySelect.textContent).toContain('Last watched date');

    const sortToggle = fixture.nativeElement.querySelector('button[aria-label^="Sort direction"]');
    expect(sortToggle).not.toBeNull();
    expect(sortToggle.getAttribute('title')).toMatch(/Ascending|Descending/);
    expect(sortToggle.getAttribute('aria-label')).toContain('Sort direction');
    expect(sortToggle.querySelector('svg')).not.toBeNull();
  });

  it('returns empty when no items', () => {
    setup({ watchItems: [] });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredItems()).toEqual([]);
  });

  it('loads default sort when localStorage has invalid values', () => {
    window.localStorage.clear();
    window.localStorage.setItem('itemSortField', 'invalid');
    window.localStorage.setItem('itemSortDirection', 'invalid');
    // Bypass setup helper to test invalid persistence directly
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: WatchListService, useValue: { items: signal([]) } },
        { provide: GroupService, useValue: { groups: signal(mockGroups).asReadonly() } },
        {
          provide: ImageStorageService,
          useValue: { version: signal(0).asReadonly(), getUrl: vi.fn(() => Promise.resolve(null)) },
        },
      ],
    });
    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.sortField()).toBe('createdAt');
    expect(fixture.componentInstance.sortDirection()).toBe('desc');
  });
});
