import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { GroupService } from '../../services/group.service';
import { ImageStorageService } from '../../services/image-storage.service';
import { WatchListService } from '../../services/watch-list.service';
import { Item } from '../../models/item.model';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { ItemViewComponent } from './item-view.component';

const item: Item = {
  id: 'series-1',
  title: 'Test Series',
  type: 'series',
  groupId: 'group-1',
  status: 'in-progress',
  isAdult: false,
  progress: {
    season: 2,
    episode: 3,
    seasons: [],
  },
  watchHistory: [
    { date: '2026-05-01T10:00:00.000Z' },
    { date: '2026-05-02T10:00:00.000Z', season: 1, episode: 1 },
  ],
  createdAt: '2026-04-01T10:00:00.000Z',
};

describe('ItemViewComponent', () => {
  function configure(items: Item[]) {
    const watchList = {
      items: signal(items),
      markWatched: vi.fn(),
      markCompleted: vi.fn(),
      markStarted: vi.fn(),
      markPaused: vi.fn(),
      markDropped: vi.fn(),
      snoozeOneWeek: vi.fn().mockResolvedValue(undefined),
      removeOneWeekDelay: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { timezone: 'UTC' } },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: items[0]?.id ?? '' })) },
        },
        {
          provide: WatchListService,
          useValue: watchList,
        },
        {
          provide: GroupService,
          useValue: { groups: signal([{ id: 'group-1', name: 'Favourites', order: 0 }]) },
        },
        {
          provide: ImageStorageService,
          useValue: { getUrl: vi.fn(async () => null), version: signal(0).asReadonly() },
        },
      ],
    });
    return watchList;
  }

  it('renders metadata and newest-first item history', async () => {
    configure([item]);
    const fixture = TestBed.createComponent(ItemViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Test Series');
    expect(element.textContent).toContain('Favourites');
    expect(element.textContent).toContain('Apr 1, 2026');
    expect(element.textContent).toContain('S2E3');
    expect(element.textContent).toContain('S1E1');

    const historyEntries = [...element.querySelectorAll('ol li')];
    expect(historyEntries[0].textContent).toContain('May 2, 2026');
  });

  it('shows an empty-history state', async () => {
    configure([{ ...item, watchHistory: [] }]);
    const fixture = TestBed.createComponent(ItemViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('No watch history yet.');
  });

  it('shows not found for a missing item', async () => {
    configure([]);
    const fixture = TestBed.createComponent(ItemViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Item not found');
  });

  it('invokes matching quick actions', async () => {
    configure([item]);
    const fixture = TestBed.createComponent(ItemViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const service = TestBed.inject(WatchListService);
    fixture.componentInstance.runAction('watched');
    fixture.componentInstance.runAction('started');
    fixture.componentInstance.runAction('paused');
    fixture.componentInstance.runAction('dropped');

    expect(service.markWatched).toHaveBeenCalledWith(item.id);
    expect(service.markStarted).toHaveBeenCalledWith(item.id);
    expect(service.markPaused).toHaveBeenCalledWith(item.id);
    expect(service.markDropped).toHaveBeenCalledWith(item.id);
  });

  it('shows only status-appropriate quick actions', async () => {
    configure([{ ...item, type: 'series', status: 'dropped', isAdult: false }]);
    const fixture = TestBed.createComponent(ItemViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
    const labels = buttons.map((button) => button.textContent?.trim());

    expect(labels).toEqual(['Start']);
  });

  it.each(['series', 'ova', 'ona'] as const)(
    'shows %s release delay, estimate, and reversible actions',
    async (type) => {
      const current: Item = {
        ...item,
        type,
        progress: {
          season: 2,
          episode: 3,
          seasons: [{ seasonNumber: 2, firstEpisodeAirDate: '2026-10-01', snoozeCount: 2 }],
        },
      };
      const service = configure([current]);
      TestBed.overrideProvider(DATE_PIPE_DEFAULT_OPTIONS, { useValue: {} });
      const fixture = TestBed.createComponent(ItemViewComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const button = (label: string) =>
        [...element.querySelectorAll('button')].find(
          (button) => button.textContent?.trim() === label,
        )!;
      expect(element.textContent).toMatch(/Season 2 release delay:\s*2 weeks/);
      expect(element.textContent).toContain('Pending episode air date (estimate): Oct 29, 2026');
      expect(button('Snooze 1 week').disabled).toBe(false);
      button('Snooze 1 week').click();
      await fixture.whenStable();
      expect(service.snoozeOneWeek).toHaveBeenCalledWith(item.id);
      button('Remove 1 week delay').click();
      await fixture.whenStable();
      expect(service.removeOneWeekDelay).toHaveBeenCalledWith(item.id);

      service.items.set([
        {
          ...current,
          progress: {
            ...current.progress!,
            seasons: [{ ...current.progress!.seasons[0], snoozeCount: 1 }],
          },
        },
      ]);
      fixture.detectChanges();
      expect(element.textContent).toMatch(/Season 2 release delay:\s*1 week\s/);
      service.items.set([
        {
          ...current,
          progress: {
            ...current.progress!,
            seasons: [{ ...current.progress!.seasons[0], snoozeCount: 0 }],
          },
        },
      ]);
      fixture.detectChanges();
      expect(element.textContent).toContain('no added delay');
      expect(element.textContent).not.toContain('Remove 1 week delay');
    },
  );

  it.each([undefined, '2026-02-31'])(
    'disables snoozing for an unusable date %s, but still permits removing delay',
    async (firstEpisodeAirDate) => {
      const service = configure([
        {
          ...item,
          progress: {
            season: 2,
            episode: 3,
            seasons: [{ seasonNumber: 2, firstEpisodeAirDate, snoozeCount: 1 }],
          },
        },
      ]);
      const fixture = TestBed.createComponent(ItemViewComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const snooze = [...element.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Snooze 1 week',
      )!;
      expect(snooze.disabled).toBe(true);
      expect(element.textContent).toContain(
        "Set this season's first episode air date to snooze its release schedule.",
      );
      expect(element.querySelector('a[href="/items/series-1/edit"]')).not.toBeNull();
      await fixture.componentInstance.changeReleaseDelay(-1);
      expect(service.removeOneWeekDelay).toHaveBeenCalledWith(item.id);
      expect(element.textContent).not.toContain('Pending episode air date');
    },
  );

  it.each([undefined, { season: 2, episode: 3, seasons: [] }])(
    'disables snoozing for missing progress or matching season',
    async (progress) => {
      configure([{ ...item, progress }]);
      const fixture = TestBed.createComponent(ItemViewComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
      expect(
        buttons.find((button) => button.textContent?.trim() === 'Snooze 1 week')?.disabled,
      ).toBe(true);
    },
  );

  it.each([
    { type: 'movie', status: 'in-progress' },
    { type: 'series', status: 'paused' },
    { type: 'series', status: 'not-started' },
    { type: 'series', status: 'completed' },
    { type: 'series', status: 'dropped' },
  ] as const)('hides delay controls for $status $type', async (overrides) => {
    configure([{ ...item, ...overrides }]);
    const fixture = TestBed.createComponent(ItemViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('Snooze 1 week');
    expect(fixture.nativeElement.textContent).not.toContain('Remove 1 week delay');
  });

  it('reports failed saves and makes the controls usable again', async () => {
    const service = configure([
      {
        ...item,
        progress: {
          season: 2,
          episode: 3,
          seasons: [{ seasonNumber: 2, firstEpisodeAirDate: '2026-10-01' }],
        },
      },
    ]);
    service.snoozeOneWeek.mockRejectedValueOnce(new Error('Disk full'));
    const fixture = TestBed.createComponent(ItemViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.changeReleaseDelay(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Could not save the release delay. Please try again.',
    );
    expect(fixture.componentInstance.savingReleaseDelay()).toBe(false);
    expect(fixture.componentInstance.snoozeCount()).toBe(0);
  });

  it('does not show ineffective quick actions for a new item', async () => {
    configure([
      { ...item, type: 'movie', status: 'not-started', isAdult: false, watchHistory: [] },
    ]);
    const fixture = TestBed.createComponent(ItemViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const labels = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('section button'),
    ].map((button) => button.textContent?.trim());

    expect(labels).toEqual(['Mark Watched', 'Start', 'Drop']);
  });
});
