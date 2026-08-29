import { TestBed } from '@angular/core/testing';
import { ItemSortService } from './item-sort.service';

describe('ItemSortService', () => {
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
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    store = {};
    window.localStorage.clear();
  });

  it('defaults to createdAt desc when storage empty', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ItemSortService);
    expect(service.field()).toBe('createdAt');
    expect(service.direction()).toBe('desc');
  });

  it('loads persisted values from localStorage', () => {
    localStorage.setItem('itemSortField', 'title');
    localStorage.setItem('itemSortDirection', 'asc');
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ItemSortService);
    expect(service.field()).toBe('title');
    expect(service.direction()).toBe('asc');
  });

  it('loads lastWatched field', () => {
    localStorage.setItem('itemSortField', 'lastWatched');
    localStorage.setItem('itemSortDirection', 'desc');
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ItemSortService);
    expect(service.field()).toBe('lastWatched');
    expect(service.direction()).toBe('desc');
  });

  it('falls back to defaults for invalid stored values', () => {
    localStorage.setItem('itemSortField', 'invalid');
    localStorage.setItem('itemSortDirection', 'invalid');
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ItemSortService);
    expect(service.field()).toBe('createdAt');
    expect(service.direction()).toBe('desc');
  });

  it('falls back when only field is invalid', () => {
    localStorage.setItem('itemSortField', 'name');
    localStorage.setItem('itemSortDirection', 'asc');
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ItemSortService);
    expect(service.field()).toBe('createdAt');
    expect(service.direction()).toBe('asc');
  });

  it('setField updates signal and persists', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ItemSortService);
    service.setField('title');
    expect(service.field()).toBe('title');
    expect(localStorage.getItem('itemSortField')).toBe('title');

    service.setField('lastWatched');
    expect(service.field()).toBe('lastWatched');
    expect(localStorage.getItem('itemSortField')).toBe('lastWatched');
  });

  it('setDirection updates signal and persists', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ItemSortService);
    service.setDirection('asc');
    expect(service.direction()).toBe('asc');
    expect(localStorage.getItem('itemSortDirection')).toBe('asc');

    service.setDirection('desc');
    expect(service.direction()).toBe('desc');
    expect(localStorage.getItem('itemSortDirection')).toBe('desc');
  });

  it('exposes readonly signals', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ItemSortService);
    expect(service.field()).toBeDefined();
    expect(service.direction()).toBeDefined();
  });

  it('handles localStorage getItem throwing', () => {
    const originalGetItem = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error('blocked');
    };
    try {
      TestBed.configureTestingModule({});
      const service = TestBed.inject(ItemSortService);
      expect(service.field()).toBe('createdAt');
      expect(service.direction()).toBe('desc');
    } finally {
      window.localStorage.getItem = originalGetItem;
    }
  });

  it('handles localStorage setItem throwing', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ItemSortService);
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error('quota exceeded');
    };
    try {
      service.setField('title');
      service.setDirection('asc');
      // in-memory should still update
      expect(service.field()).toBe('title');
      expect(service.direction()).toBe('asc');
    } finally {
      window.localStorage.setItem = originalSetItem;
    }
  });
});
