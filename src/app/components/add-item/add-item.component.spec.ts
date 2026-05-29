import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { GroupService } from '../../services/group.service';
import { WatchListService } from '../../services/watch-list.service';
import { TmdbSuggestionService } from '../../services/tmdb-suggestion.service';
import { Item } from '../../models/item.model';
import { AddItemComponent } from './add-item.component';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';

describe('AddItemComponent', () => {
  const existingItems: Item[] = [
    {
      id: 'item-1',
      title: 'Existing Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'not-started',
      progress: {
        season: 1,
        episode: 1,
        seasons: []
      },
      watchHistory: [],
      createdAt: '2026-05-01T10:00:00.000Z'
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: WatchListService,
          useValue: {
            items: signal(existingItems),
            addItem: vi.fn()
          }
        },
        {
          provide: GroupService,
          useValue: {
            groups: signal([{ id: 'ungrouped', name: 'Ungrouped', order: 0 }])
          }
        },
        {
          provide: TmdbSuggestionService,
          useValue: {
            search: vi.fn(() => of([]))
          }
        }
      ]
    });
  });

  it('shows a duplicate hint for an existing title with different casing and whitespace', async () => {
    const fixture = TestBed.createComponent(AddItemComponent);

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.title.set('  existing show  ');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'An item named "Existing Show" already exists.'
    );
  });

  it('does not block submitting an item with a duplicate title', () => {
    const fixture = TestBed.createComponent(AddItemComponent);
    const watchListService = TestBed.inject(WatchListService);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    fixture.componentInstance.onSubmit({
      title: 'Existing Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'not-started',
      season: 1,
      episode: 1,
      seasons: [],
      startImmediately: false
    });

    expect(watchListService.addItem).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/items']);
  });

  it('clears suggestions after selecting a TMDB suggestion', () => {
    const fixture = TestBed.createComponent(AddItemComponent);

    fixture.componentInstance.suggestions.set([
      {
        tmdbId: 1396,
        title: 'Breaking Bad',
        type: 'series',
        year: '2008'
      }
    ]);

    fixture.componentInstance.onSuggestionSelected({
      tmdbId: 1396,
      title: 'Breaking Bad',
      type: 'series',
      year: '2008'
    });

    expect(fixture.componentInstance.title()).toBe('Breaking Bad');
    expect(fixture.componentInstance.suggestions()).toEqual([]);
    expect(fixture.componentInstance.suggestionsLoading()).toBe(false);
  });

  it('shows a TMDB error and keeps searching after a failed request', async () => {
    vi.useFakeTimers();
    const tmdbSuggestionService = TestBed.inject(TmdbSuggestionService);
    const search = vi.mocked(tmdbSuggestionService.search);
    try {
      search
        .mockReturnValueOnce(throwError(() => new Error('TMDB unavailable')))
        .mockReturnValueOnce(
          of([
            {
              tmdbId: 1396,
              title: 'Breaking Bad',
              type: 'series',
              year: '2008'
            }
          ])
        );
      const fixture = TestBed.createComponent(AddItemComponent);

      fixture.componentInstance.onTitleChanged('bad query');
      await vi.advanceTimersByTimeAsync(250);

      expect(fixture.componentInstance.suggestions()).toEqual([]);
      expect(fixture.componentInstance.suggestionsLoading()).toBe(false);
      expect(fixture.componentInstance.suggestionsError()).toBe('TMDB suggestions are unavailable.');

      fixture.componentInstance.onTitleChanged('good query');
      await vi.advanceTimersByTimeAsync(250);

      expect(fixture.componentInstance.suggestions()).toEqual([
        {
          tmdbId: 1396,
          title: 'Breaking Bad',
          type: 'series',
          year: '2008'
        }
      ]);
      expect(fixture.componentInstance.suggestionsError()).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});
