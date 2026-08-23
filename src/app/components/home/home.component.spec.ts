import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Item } from '../../models/item.model';
import { RoundRobinService } from '../../services/round-robin.service';
import { WatchListService } from '../../services/watch-list.service';
import { HomeComponent } from './home.component';

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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: RoundRobinService,
          useValue: { nextSeries: signal(null), nextMovie: signal(null) },
        },
        {
          provide: WatchListService,
          useValue: {
            items: signal(items),
            inProgressSeries: signal([]),
            markStarted: vi.fn(),
            markDropped: vi.fn(),
          },
        },
      ],
    });
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
});
