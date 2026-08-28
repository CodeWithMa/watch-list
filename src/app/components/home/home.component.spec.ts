import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Item } from '../../models/item.model';
import { RoundRobinService } from '../../services/round-robin.service';
import { WatchListService } from '../../services/watch-list.service';
import { ImageStorageService } from '../../services/image-storage.service';
import { HomeComponent } from './home.component';

function createItem(overrides: Partial<Item> & Pick<Item, 'id' | 'title'>): Item {
  return {
    type: 'series',
    groupId: 'ungrouped',
    status: 'not-started',
    watchHistory: [],
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  } as Item;
}

describe('HomeComponent', () => {
  const items: Item[] = [
    {
      id: 'paused-movie',
      title: 'Paused Movie',
      type: 'movie',
      groupId: 'ungrouped',
      status: 'paused',
      watchHistory: [],
      createdAt: '2026-05-02T10:00:00.000Z',
    },
    {
      id: 'backlog-item',
      title: 'Backlog Series',
      type: 'series',
      groupId: 'ungrouped',
      status: 'not-started',
      watchHistory: [],
      createdAt: '2026-05-01T10:00:00.000Z',
    },
  ];

  function setup({
    watchItems = items,
    inProgressSeries = [],
    nextSeries = null,
    nextMovie = null,
  }: {
    watchItems?: Item[];
    inProgressSeries?: Item[];
    nextSeries?: Item | null;
    nextMovie?: Item | null;
  } = {}) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: RoundRobinService,
          useValue: { nextSeries: signal(nextSeries), nextMovie: signal(nextMovie) },
        },
        {
          provide: WatchListService,
          useValue: {
            items: signal(watchItems),
            inProgressSeries: signal(inProgressSeries),
            markStarted: vi.fn(),
            markDropped: vi.fn(),
            markWatched: vi.fn(),
            markCompleted: vi.fn(),
            markPaused: vi.fn(),
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

  beforeEach(() => {
    setup();
  });

  it('shows paused movies separately from backlog', async () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const sections = Array.from(
      fixture.nativeElement.querySelectorAll('h2'),
    ) as HTMLHeadingElement[];
    const pausedSection = sections.find((section) => section.textContent?.trim() === 'Paused');
    const pausedContainer = pausedSection?.parentElement;

    expect(pausedContainer?.textContent).toContain('Paused Movie');
    expect(pausedContainer?.textContent).not.toContain('Backlog Series');
  });

  it('resumes and drops paused items', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    const watchListService = TestBed.inject(WatchListService);

    fixture.componentInstance.resumePausedItem('paused-movie');
    fixture.componentInstance.dropPausedItem('paused-movie');

    expect(watchListService.markStarted).toHaveBeenCalledWith('paused-movie');
    expect(watchListService.markDropped).toHaveBeenCalledWith('paused-movie');
  });

  it('shows an empty state when no items are paused', async () => {
    setup({ watchItems: [] });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No items paused');
  });

  it('computes backlogItems sorted newest first', () => {
    const backlog = [
      createItem({
        id: 'a',
        title: 'A',
        status: 'not-started',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      createItem({
        id: 'b',
        title: 'B',
        status: 'not-started',
        createdAt: '2026-03-01T00:00:00.000Z',
      }),
      createItem({ id: 'c', title: 'C', status: 'paused', createdAt: '2026-02-01T00:00:00.000Z' }),
    ];
    setup({ watchItems: backlog });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.backlogItems().map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('computes pausedItems sorted newest first', () => {
    const paused = [
      createItem({
        id: 'p1',
        title: 'P1',
        status: 'paused',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      createItem({
        id: 'p2',
        title: 'P2',
        status: 'paused',
        createdAt: '2026-02-01T00:00:00.000Z',
      }),
    ];
    setup({ watchItems: paused });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.pausedItems().map((i) => i.id)).toEqual(['p2', 'p1']);
  });

  it('shows backlog and paused empty states', async () => {
    setup({ watchItems: [] });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No items in backlog');
    expect(fixture.nativeElement.textContent).toContain('No items paused');
  });

  it('shows backlog items and handles start/drop backlog', () => {
    setup();
    const fixture = TestBed.createComponent(HomeComponent);
    const svc = TestBed.inject(WatchListService);
    fixture.componentInstance.startBacklogItem('backlog-item');
    fixture.componentInstance.dropBacklogItem('backlog-item');
    expect(svc.markStarted).toHaveBeenCalledWith('backlog-item');
    expect(svc.markDropped).toHaveBeenCalledWith('backlog-item');
  });

  it('markItem delegates to correct service methods', () => {
    setup();
    const fixture = TestBed.createComponent(HomeComponent);
    const svc = TestBed.inject(WatchListService) as unknown as {
      markWatched: ReturnType<typeof vi.fn>;
      markCompleted: ReturnType<typeof vi.fn>;
      markDropped: ReturnType<typeof vi.fn>;
      markPaused: ReturnType<typeof vi.fn>;
    };
    const item = createItem({ id: 'x', title: 'X', status: 'in-progress' });

    fixture.componentInstance.markItem(() => item, 'watched');
    expect(svc.markWatched).toHaveBeenCalledWith('x');

    fixture.componentInstance.markItem(() => item, 'completed');
    expect(svc.markCompleted).toHaveBeenCalledWith('x');

    fixture.componentInstance.markItem(() => item, 'dropped');
    expect(svc.markDropped).toHaveBeenCalledWith('x');

    fixture.componentInstance.markItem(() => item, 'paused');
    expect(svc.markPaused).toHaveBeenCalledWith('x');
  });

  it('markItem does nothing when getter returns null', () => {
    setup();
    const fixture = TestBed.createComponent(HomeComponent);
    const svc = TestBed.inject(WatchListService);
    fixture.componentInstance.markItem(() => null, 'watched');
    fixture.componentInstance.markItem(() => undefined, 'completed');
    expect(svc.markWatched).not.toHaveBeenCalled();
    expect(svc.markCompleted).not.toHaveBeenCalled();
  });

  it('renders nextSeries and nextMovie when provided', async () => {
    const series = createItem({
      id: 's1',
      title: 'Series 1',
      type: 'series',
      status: 'in-progress',
      posterId: 'p1',
    });
    const movie = createItem({ id: 'm1', title: 'Movie 1', type: 'movie', status: 'in-progress' });
    setup({
      nextSeries: series,
      nextMovie: movie,
      watchItems: [series, movie],
      inProgressSeries: [series],
    });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Series 1');
    expect(fixture.nativeElement.textContent).toContain('Movie 1');
  });

  it('shows empty states for nextSeries/nextMovie', async () => {
    // No series in list
    setup({ watchItems: [], inProgressSeries: [], nextSeries: null, nextMovie: null });
    let fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No series in your watch list');

    // Has series but none in progress
    const seriesNotStarted = createItem({
      id: 's1',
      title: 'S',
      type: 'series',
      status: 'not-started',
    });
    setup({
      watchItems: [seriesNotStarted],
      inProgressSeries: [],
      nextSeries: null,
      nextMovie: null,
    });
    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No series currently being watched');

    // Has in-progress but not watchable (all future)
    const inProg = createItem({ id: 's2', title: 'S2', type: 'series', status: 'in-progress' });
    setup({ watchItems: [inProg], inProgressSeries: [inProg], nextSeries: null, nextMovie: null });
    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No aired series episodes available');

    // Movies
    setup({ watchItems: [], inProgressSeries: [], nextSeries: null, nextMovie: null });
    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No movies in your watch list');

    const movieNotStarted = createItem({
      id: 'm1',
      title: 'M',
      type: 'movie',
      status: 'not-started',
    });
    setup({
      watchItems: [movieNotStarted],
      inProgressSeries: [],
      nextSeries: null,
      nextMovie: null,
    });
    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No movies currently being watched');
  });

  it('computes hasSeries and hasMovies correctly', () => {
    setup({ watchItems: [createItem({ id: '1', title: 'S', type: 'series' })] });
    let fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    expect((fixture.componentInstance as unknown as { hasSeries: () => boolean }).hasSeries()).toBe(
      true,
    );

    setup({ watchItems: [createItem({ id: '2', title: 'M', type: 'movie' })] });
    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    expect((fixture.componentInstance as unknown as { hasMovies: () => boolean }).hasMovies()).toBe(
      true,
    );

    setup({ watchItems: [] });
    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    expect((fixture.componentInstance as unknown as { hasSeries: () => boolean }).hasSeries()).toBe(
      false,
    );
  });
});
