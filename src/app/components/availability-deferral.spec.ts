import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { formatDate } from '@angular/common';
import { IDBFactory } from 'fake-indexeddb';
import { vi } from 'vitest';
import { HomeComponent } from './home/home.component';
import { StorageService } from '../services/storage.service';
import { WatchListService } from '../services/watch-list.service';
import { createDefaultStorageData } from '../domain/storage-schema';
import { Item } from '../models/item.model';
import { ItemViewComponent } from './item-view/item-view.component';
import { routes } from '../app.routes';
import { RoundRobinService } from '../services/round-robin.service';
import { controlStorageWrites } from '../services/indexeddb-write.test-utils';

describe('Availability deferral controls', () => {
  beforeEach(async () => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
    await TestBed.inject(StorageService).initialize();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens with one hour and a local return preview; cancelling leaves the episode eligible', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T10:00:00.000Z'));
    await saveItems([series('first')]);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    button(root, 'Not available yet').click();
    fixture.detectChanges();
    expect(root.querySelector('input')?.value).toBe('1');
    expect(root.textContent).toContain(formatDate('2026-10-20T11:00:00.000Z', 'short', 'en-US'));
    button(root, 'Cancel').click();
    fixture.detectChanges();
    expect(root.querySelector('input')).toBeNull();
    expect(
      TestBed.inject(WatchListService).getItemById('first')?.availabilityDeferral,
    ).toBeUndefined();
    expect(root.textContent).toContain('First');
  });

  it.each(['series', 'ova', 'ona'] as const)(
    'validates whole hours and recommends another show after confirming a %s deferral',
    async (type) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-20T10:00:00.000Z'));
      await saveItems([series('first', type), series('other')]);
      const fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      button(root, 'Not available yet').click();
      fixture.detectChanges();
      const input = root.querySelector('input')!;
      for (const value of ['', '0', '-1', '1.5', '1.0000000000000001', '1e309', '1000000000000']) {
        input.value = value;
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        expect(button(root, 'Confirm deferral').disabled, value).toBe(true);
        expect(root.textContent).not.toContain('Returns ');
      }
      input.value = '2';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(button(root, 'Confirm deferral').disabled).toBe(false);
      expect(root.textContent).toContain(formatDate('2026-10-20T12:00:00.000Z', 'short', 'en-US'));
      await fixture.componentInstance.confirmDeferral();
      fixture.detectChanges();
      expect(root.querySelector('input')).toBeNull();
      expect(root.textContent).toContain('Other');
      expect(root.textContent).not.toContain('First');
      expect(TestBed.inject(WatchListService).getItemById('first')?.availabilityDeferral).toEqual({
        season: 1,
        episode: 1,
        until: '2026-10-20T12:00:00.000Z',
      });
    },
  );

  it('explains the all-deferred state with the earliest local return while movies remain recommendable', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T10:00:00.000Z'));
    await saveItems([
      series('first'),
      series('other'),
      { ...series('movie', 'movie'), title: 'Movie' },
    ]);
    const watch = TestBed.inject(WatchListService);
    await watch.deferEpisode('first', 2);
    await watch.deferEpisode('other', 1);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('All aired episodes are temporarily deferred');
    expect(root.textContent).toContain(formatDate('2026-10-20T11:00:00.000Z', 'short', 'en-US'));
    expect(root.textContent).toContain('Movie');
    expect(root.textContent).not.toContain('First');
    expect(root.textContent).not.toContain('Other');
    expect(
      Array.from(root.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Not available yet'),
      ),
    ).toBe(false);
  });

  it('shows a live deferral on the item page and clears it without changing watch state', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T10:00:00.000Z'));
    await saveItems([series('first')]);
    const harness = await RouterTestingHarness.create();
    const detail = await harness.navigateByUrl('/items/first', ItemViewComponent);
    const root = harness.routeNativeElement!;
    const watch = TestBed.inject(WatchListService);
    await watch.deferEpisode('first', 1);
    harness.detectChanges();
    expect(root.textContent).toContain('Availability deferred until');
    expect(root.textContent).toContain(formatDate('2026-10-20T11:00:00.000Z', 'short', 'en-US'));
    button(root, 'Clear deferral');
    await detail.clearDeferral();
    harness.detectChanges();
    expect(root.textContent).not.toContain('Availability deferred until');
    expect(watch.getItemById('first')).toEqual(series('first'));
    expect(TestBed.inject(RoundRobinService).nextSeries()?.id).toBe('first');
  });

  it('keeps the recommendation and duration chooser on a failed save, then allows retry', async () => {
    await saveItems([series('first'), series('other')]);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    button(root, 'Not available yet').click();
    fixture.detectChanges();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = controlStorageWrites([false]);
    await fixture.componentInstance.confirmDeferral();
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not save the availability deferral.',
    );
    expect(root.querySelector('input')?.value).toBe('1');
    expect(TestBed.inject(RoundRobinService).nextSeries()?.id).toBe('first');
    expect(
      TestBed.inject(WatchListService).getItemById('first')?.availabilityDeferral,
    ).toBeUndefined();
    expect(root.textContent).not.toContain('Changed for this session only');
    failure.mockRestore();
    await fixture.componentInstance.confirmDeferral();
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.querySelector('input')).toBeNull();
    expect(TestBed.inject(RoundRobinService).nextSeries()?.id).toBe('other');
  });

  it('keeps the detail status and exclusion when clearing fails', async () => {
    await saveItems([series('first')]);
    await TestBed.inject(WatchListService).deferEpisode('first', 1);
    const harness = await RouterTestingHarness.create();
    const detail = await harness.navigateByUrl('/items/first', ItemViewComponent);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    controlStorageWrites([false]);
    await detail.clearDeferral();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain(
      'Unable to clear the availability deferral.',
    );
    expect(harness.routeNativeElement?.textContent).toContain('Availability deferred until');
    expect(TestBed.inject(RoundRobinService).nextSeries()).toBeNull();
  });

  it('removes expired status on the detail page without a data edit', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-10-20T10:00:00.000Z'));
    await saveItems([series('first')]);
    await TestBed.inject(WatchListService).deferEpisode('first', 1);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/items/first', ItemViewComponent);
    const before = TestBed.inject(StorageService).getData();
    expect(harness.routeNativeElement?.textContent).toContain('Availability deferred until');
    vi.advanceTimersByTime(3_600_000);
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).not.toContain('Availability deferred until');
    expect(TestBed.inject(StorageService).getData()).toEqual(before);
  });
});

function series(id: string, type: Item['type'] = 'series'): Item {
  return {
    id,
    title: id === 'first' ? 'First' : 'Other',
    type,
    status: 'in-progress',
    groupId: 'ungrouped',
    isAdult: false,
    watchHistory: [],
    createdAt: id === 'first' ? '2026-01-01' : '2026-02-01',
    progress: { season: 1, episode: 1, seasons: [] },
  };
}

function saveItems(items: Item[]) {
  return TestBed.inject(StorageService).replaceData({
    ...createDefaultStorageData(),
    items: Object.fromEntries(items.map((item) => [item.id, item])),
  });
}

function button(root: HTMLElement, label: string) {
  const match = Array.from(root.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === label,
  );
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}
