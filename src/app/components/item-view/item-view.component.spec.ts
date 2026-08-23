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
  function configure(items: Item[]): void {
    TestBed.configureTestingModule({
      providers: [
        { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { timezone: 'UTC' } },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: items[0]?.id ?? '' })) },
        },
        {
          provide: WatchListService,
          useValue: {
            items: signal(items),
            markWatched: vi.fn(),
            markCompleted: vi.fn(),
            markStarted: vi.fn(),
            markPaused: vi.fn(),
            markDropped: vi.fn(),
          },
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
    configure([{ ...item, type: 'series', status: 'dropped' }]);
    const fixture = TestBed.createComponent(ItemViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
    const labels = buttons.map((button) => button.textContent?.trim());

    expect(labels).toEqual(['Start']);
  });

  it('does not show ineffective quick actions for a new item', async () => {
    configure([{ ...item, type: 'movie', status: 'not-started', watchHistory: [] }]);
    const fixture = TestBed.createComponent(ItemViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const labels = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('section button'),
    ].map((button) => button.textContent?.trim());

    expect(labels).toEqual(['Mark Watched', 'Start', 'Drop']);
  });
});
