import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { StorageService } from '../services/storage.service';
import { HomeComponent } from './home/home.component';
import { ItemViewComponent } from './item-view/item-view.component';
import { of } from 'rxjs';
import type { ItemStatus } from '../models/item.model';
import { WatchListService } from '../services/watch-list.service';
import { controlStorageWrites } from '../services/indexeddb-write.test-utils';

const screens = [
  { component: HomeComponent, name: 'Home' },
  { component: ItemViewComponent, name: 'ItemView' },
];

describe('Settled watch interactions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each(screens)(
    'keeps $name actions disabled until commit and ignores duplicate clicks',
    async ({ component }) => {
      const { storage } = await setup();
      const fixture = TestBed.createComponent<HomeComponent | ItemViewComponent>(component);
      fixture.detectChanges();
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const watched = element.querySelector('button')!;
      let disabledBeforeCommit: boolean[] = [];
      controlStorageWrites([], (index) => {
        if (index !== 0) return;
        fixture.detectChanges();
        disabledBeforeCommit = [...element.querySelectorAll('button')].map((b) => b.disabled);
        for (const button of element.querySelectorAll('button')) button.click();
      });
      watched.click();
      watched.click();
      await vi.waitFor(() =>
        expect(storage.getData().items['series'].watchHistory).toHaveLength(1),
      );
      await storage.mutate(() => undefined);
      fixture.detectChanges();
      expect(disabledBeforeCommit).toEqual(
        component === HomeComponent ? [true, true, true] : [true, true, true, true],
      );
      expect(storage.getData().items['series'].watchHistory).toHaveLength(1);
      expect(watched.disabled).toBe(false);
    },
  );

  describe.each(screens)('$name', ({ component }) => {
    const scenarios: { label: string; status: ItemStatus; expectedStatus: ItemStatus }[] = [
      { label: 'Mark Watched', status: 'in-progress', expectedStatus: 'in-progress' },
      { label: 'Pause', status: 'in-progress', expectedStatus: 'paused' },
      { label: 'Drop', status: 'in-progress', expectedStatus: 'dropped' },
      {
        label: component === HomeComponent ? 'Add to currently watching' : 'Start',
        status: 'not-started',
        expectedStatus: 'in-progress',
      },
      { label: 'Drop', status: 'not-started', expectedStatus: 'dropped' },
      { label: 'Resume', status: 'paused', expectedStatus: 'in-progress' },
      { label: 'Drop', status: 'paused', expectedStatus: 'dropped' },
      ...(component === ItemViewComponent
        ? ([
            { label: 'Snooze 1 week', status: 'in-progress', expectedStatus: 'in-progress' },
            { label: 'Remove 1 week delay', status: 'in-progress', expectedStatus: 'in-progress' },
          ] as const)
        : []),
    ];

    it.each(scenarios)(
      'reports a failed $label from $status and allows retry',
      async ({ label, status, expectedStatus }) => {
        const { storage } = await setup({
          status,
          snoozeCount: label === 'Remove 1 week delay' ? 1 : 0,
        });
        const fixture = TestBed.createComponent<HomeComponent | ItemViewComponent>(component);
        fixture.detectChanges();
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const button = () =>
          [...element.querySelectorAll('button')].find(
            (button) => button.textContent?.trim() === label,
          )!;
        const original = storage.getData().items['series'];
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        controlStorageWrites([false]);
        button().click();
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(element.querySelector('[role="alert"]')?.textContent).toContain(
            'Please try again.',
          );
        });
        expect(storage.getData().items['series']).toEqual(original);
        expect(button().disabled).toBe(false);
        button().click();
        await vi.waitFor(() => {
          expect(fixture.componentInstance.actions.busy()).toBe(false);
          expect(storage.getData().items['series']).not.toEqual(original);
        });
        fixture.detectChanges();
        const item = storage.getData().items['series'];
        expect(element.querySelector('[role="alert"]')).toBeNull();
        expect(item.status).toBe(expectedStatus);
        expect(item.watchHistory).toHaveLength(label === 'Mark Watched' ? 1 : 0);
        expect(item.progress?.seasons[0].snoozeCount).toBe(label === 'Snooze 1 week' ? 1 : 0);
        const reloaded = TestBed.runInInjectionContext(() => new StorageService());
        await reloaded.initialize();
        expect(reloaded.getData()).toEqual(storage.getData());
      },
    );

    it('identifies session-only success', async () => {
      const { storage } = await setup({ session: true });
      const fixture = TestBed.createComponent<HomeComponent | ItemViewComponent>(component);
      fixture.detectChanges();
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      element.querySelector('button')!.click();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(element.querySelector('[role="status"]')?.textContent).toContain(
          'this session only; not saved to disk',
        );
      });
      expect(storage.getData().items['series'].watchHistory).toHaveLength(1);
      expect(element.querySelector('[role="alert"]')).toBeNull();
    });
  });

  it('renders retained history even when legitimate watched commands share a timestamp', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-18T10:00:00Z'));
    await setup();
    const fixture = TestBed.createComponent(ItemViewComponent);
    fixture.detectChanges();
    const watch = TestBed.inject(WatchListService);
    await Promise.all([watch.markWatched('series'), watch.markWatched('series')]);
    fixture.detectChanges();
    const entries = [...(fixture.nativeElement as HTMLElement).querySelectorAll('ol li')];
    expect(entries).toHaveLength(2);
    expect(entries[0].textContent).toContain('S1E1');
    expect(entries[1].textContent).toContain('S1E2');
  });
});

async function setup({
  status = 'in-progress',
  snoozeCount = 0,
  session = false,
}: { status?: ItemStatus; snoozeCount?: number; session?: boolean } = {}) {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  if (session) {
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('Unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  }
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'series' })) } },
    ],
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
        status,
        isAdult: false,
        createdAt: '2026-01-01',
        watchHistory: [],
        progress: {
          season: 1,
          episode: 1,
          seasons: [
            { seasonNumber: 1, totalEpisodes: 10, firstEpisodeAirDate: '2026-01-01', snoozeCount },
          ],
        },
      },
    },
  });
  return { storage };
}
