import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { GroupService } from '../../services/group.service';
import { WatchListService } from '../../services/watch-list.service';
import { SuggestionSearchService } from '../../services/suggestion-search.service';
import { Item } from '../../models/item.model';
import { Suggestion } from '../../models/suggestion.model';
import { AddItemComponent } from './add-item.component';
import { vi } from 'vitest';
import { Observable, Subject, of, throwError } from 'rxjs';

function createSuggestion(
  overrides: Partial<Suggestion> & Pick<Suggestion, 'id' | 'title' | 'type'>,
): Suggestion {
  return {
    source: 'tmdb',
    isAdult: false,
    ...overrides,
  };
}

describe('AddItemComponent', () => {
  const existingItems: Item[] = [
    {
      id: 'item-1',
      title: 'Existing Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'not-started',
      isAdult: false,
      progress: {
        season: 1,
        episode: 1,
        seasons: [],
      },
      watchHistory: [],
      createdAt: '2026-05-01T10:00:00.000Z',
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: WatchListService,
          useValue: {
            items: signal(existingItems),
            addItem: vi.fn(),
          },
        },
        {
          provide: GroupService,
          useValue: {
            groups: signal([{ id: 'ungrouped', name: 'Ungrouped', order: 0 }]),
          },
        },
        {
          provide: SuggestionSearchService,
          useValue: {
            search: vi.fn(() => of([])),
            getDetails: vi.fn(() => of(null)),
          },
        },
      ],
    });
  });

  it('shows a duplicate hint for an existing title with different casing and whitespace', async () => {
    const fixture = TestBed.createComponent(AddItemComponent);

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.title.set('  existing show  ');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'An item named "Existing Show" already exists.',
    );
  });

  it('does not block submitting an item with a duplicate title', async () => {
    const fixture = TestBed.createComponent(AddItemComponent);
    const watchListService = TestBed.inject(WatchListService);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    fixture.componentInstance.onSubmit({
      title: 'Existing Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'not-started',
      isAdult: false,
      season: 1,
      episode: 1,
      seasons: [],
      startImmediately: false,
    });

    await Promise.resolve();

    expect(watchListService.addItem).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/items']);
  });

  it('clears suggestions after selecting a suggestion', () => {
    const fixture = TestBed.createComponent(AddItemComponent);

    fixture.componentInstance.suggestions.set([
      createSuggestion({ id: 1396, title: 'Breaking Bad', type: 'series', year: '2008' }),
    ]);

    fixture.componentInstance.onSuggestionSelected(
      createSuggestion({ id: 1396, title: 'Breaking Bad', type: 'series', year: '2008' }),
    );

    expect(fixture.componentInstance.title()).toBe('Breaking Bad');
    expect(fixture.componentInstance.suggestions()).toEqual([]);
    expect(fixture.componentInstance.suggestionsLoading()).toBe(false);
  });

  it('autofills seasons after selecting a TMDB series suggestion', () => {
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    vi.mocked(suggestionSearchService.getDetails).mockReturnValue(
      of({
        seasons: [
          {
            seasonNumber: 1,
            totalEpisodes: 7,
            firstEpisodeAirDate: '2008-01-20',
          },
        ],
      }),
    );
    const fixture = TestBed.createComponent(AddItemComponent);

    fixture.componentInstance.onSuggestionSelected(
      createSuggestion({
        id: 1396,
        title: 'Breaking Bad',
        type: 'series',
        year: '2008',
        posterUrl: 'https://image.tmdb.org/t/p/w342/breaking-bad.jpg',
      }),
    );

    expect(suggestionSearchService.getDetails).toHaveBeenCalledWith({ source: 'tmdb', id: 1396 });
    expect(fixture.componentInstance.autofillPatch()).toEqual({
      id: 2,
      value: {
        seasons: [
          {
            seasonNumber: 1,
            totalEpisodes: 7,
            firstEpisodeAirDate: '2008-01-20',
          },
        ],
      },
    });
  });

  it('autofills seasons after selecting a Jikan OVA suggestion', () => {
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    vi.mocked(suggestionSearchService.getDetails).mockReturnValue(
      of({
        seasons: [
          {
            seasonNumber: 1,
            totalEpisodes: 4,
            firstEpisodeAirDate: '2020-01-01',
          },
        ],
      }),
    );
    const fixture = TestBed.createComponent(AddItemComponent);

    fixture.componentInstance.onSuggestionSelected(
      createSuggestion({
        id: 999,
        source: 'jikan',
        title: 'OVA Title',
        type: 'ova',
        isAdult: false,
        year: '2020',
      }),
    );

    expect(suggestionSearchService.getDetails).toHaveBeenCalledWith({ source: 'jikan', id: 999 });
    expect(fixture.componentInstance.autofillPatch()).toEqual({
      id: 2,
      value: {
        seasons: [
          {
            seasonNumber: 1,
            totalEpisodes: 4,
            firstEpisodeAirDate: '2020-01-01',
          },
        ],
      },
    });
  });

  it('does not fetch season details for movie suggestions', () => {
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const fixture = TestBed.createComponent(AddItemComponent);

    fixture.componentInstance.onSuggestionSelected(
      createSuggestion({
        id: 11,
        title: 'Star Wars',
        type: 'movie',
        year: '1977',
        posterUrl: 'https://image.tmdb.org/t/p/w342/star-wars.jpg',
      }),
    );

    expect(suggestionSearchService.getDetails).not.toHaveBeenCalled();
    expect(fixture.componentInstance.autofillPatch()).toEqual({
      id: 1,
      value: { season: 1, episode: 1, seasons: [] },
    });
  });

  it('does not apply stale TMDB details after the title changes', () => {
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const details = new Subject<{ seasons: { seasonNumber: number; totalEpisodes: number }[] }>();
    vi.mocked(suggestionSearchService.getDetails).mockReturnValue(details.asObservable());
    const fixture = TestBed.createComponent(AddItemComponent);

    fixture.componentInstance.onSuggestionSelected(
      createSuggestion({ id: 1396, title: 'Breaking Bad', type: 'series', year: '2008' }),
    );
    fixture.componentInstance.onTitleChanged('Different show');
    details.next({
      seasons: [
        {
          seasonNumber: 1,
          totalEpisodes: 7,
        },
      ],
    });

    expect(fixture.componentInstance.autofillPatch()).toBeNull();
  });

  it('does not apply stale poster from a series when the title changes before details resolve', () => {
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const details = new Subject<{ seasons: { seasonNumber: number; totalEpisodes: number }[] }>();
    vi.mocked(suggestionSearchService.getDetails).mockReturnValue(details.asObservable());
    const fixture = TestBed.createComponent(AddItemComponent);

    fixture.componentInstance.onSuggestionSelected(
      createSuggestion({
        id: 1396,
        title: 'Breaking Bad',
        type: 'series',
        year: '2008',
        posterUrl: 'https://image.tmdb.org/t/p/w342/breaking-bad.jpg',
      }),
    );
    fixture.componentInstance.onTitleChanged('Different show');
    details.next({
      seasons: [
        {
          seasonNumber: 1,
          totalEpisodes: 7,
        },
      ],
    });

    expect(fixture.componentInstance.autofillPatch()).toBeNull();
  });

  it('does not apply stale poster from a series when a movie is selected before details resolve', () => {
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const details = new Subject<{ seasons: { seasonNumber: number; totalEpisodes: number }[] }>();
    vi.mocked(suggestionSearchService.getDetails).mockReturnValue(details.asObservable());
    const fixture = TestBed.createComponent(AddItemComponent);

    fixture.componentInstance.onSuggestionSelected(
      createSuggestion({
        id: 1396,
        title: 'Breaking Bad',
        type: 'series',
        year: '2008',
        posterUrl: 'https://image.tmdb.org/t/p/w342/breaking-bad.jpg',
      }),
    );
    fixture.componentInstance.onSuggestionSelected(
      createSuggestion({
        id: 11,
        title: 'Star Wars',
        type: 'movie',
        year: '1977',
        posterUrl: 'https://image.tmdb.org/t/p/w342/star-wars.jpg',
      }),
    );
    details.next({
      seasons: [
        {
          seasonNumber: 1,
          totalEpisodes: 7,
        },
      ],
    });

    expect(fixture.componentInstance.autofillPatch()).toEqual({
      id: 2,
      value: { season: 1, episode: 1, seasons: [] },
    });
  });

  it('cancels the previous TMDB details request when another series is selected', () => {
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    let firstRequestUnsubscribed = false;
    vi.mocked(suggestionSearchService.getDetails)
      .mockReturnValueOnce(
        new Observable((subscriber) => {
          subscriber.next({
            seasons: [
              {
                seasonNumber: 1,
                totalEpisodes: 7,
              },
            ],
          });
          return () => {
            firstRequestUnsubscribed = true;
          };
        }),
      )
      .mockReturnValueOnce(
        of({
          seasons: [
            {
              seasonNumber: 1,
              totalEpisodes: 10,
            },
          ],
        }),
      );
    const fixture = TestBed.createComponent(AddItemComponent);

    fixture.componentInstance.onSuggestionSelected(
      createSuggestion({ id: 1396, title: 'Breaking Bad', type: 'series', year: '2008' }),
    );
    fixture.componentInstance.onSuggestionSelected(
      createSuggestion({ id: 66732, title: 'Stranger Things', type: 'series', year: '2016' }),
    );

    expect(firstRequestUnsubscribed).toBe(true);
    expect(suggestionSearchService.getDetails).toHaveBeenCalledWith({ source: 'tmdb', id: 1396 });
    expect(suggestionSearchService.getDetails).toHaveBeenCalledWith({ source: 'tmdb', id: 66732 });
    expect(fixture.componentInstance.autofillPatch()).toEqual({
      id: 4,
      value: {
        seasons: [
          {
            seasonNumber: 1,
            totalEpisodes: 10,
          },
        ],
      },
    });
  });

  it('clears pending autofill details after the title changes', () => {
    const fixture = TestBed.createComponent(AddItemComponent);
    fixture.componentInstance.autofillPatch.set({
      id: 1,
      value: {
        seasons: [
          {
            seasonNumber: 1,
            totalEpisodes: 7,
          },
        ],
      },
    });

    fixture.componentInstance.onTitleChanged('Different show');

    expect(fixture.componentInstance.autofillPatch()).toBeNull();
  });

  it('shows an error and keeps searching after a failed request', async () => {
    vi.useFakeTimers();
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const search = vi.mocked(suggestionSearchService.search);
    try {
      search
        .mockReturnValueOnce(throwError(() => new Error('unavailable')))
        .mockReturnValueOnce(
          of([createSuggestion({ id: 1396, title: 'Breaking Bad', type: 'series', year: '2008' })]),
        );
      const fixture = TestBed.createComponent(AddItemComponent);

      fixture.componentInstance.onTitleChanged('bad query');
      await vi.advanceTimersByTimeAsync(400);

      expect(fixture.componentInstance.suggestions()).toEqual([]);
      expect(fixture.componentInstance.suggestionsLoading()).toBe(false);
      expect(fixture.componentInstance.suggestionsError()).toBe('Suggestions are unavailable.');

      fixture.componentInstance.onTitleChanged('good query');
      await vi.advanceTimersByTimeAsync(400);

      expect(fixture.componentInstance.suggestions()).toEqual([
        createSuggestion({ id: 1396, title: 'Breaking Bad', type: 'series', year: '2008' }),
      ]);
      expect(fixture.componentInstance.suggestionsError()).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not search again for whitespace-only title changes', async () => {
    vi.useFakeTimers();
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const search = vi.mocked(suggestionSearchService.search);
    try {
      const fixture = TestBed.createComponent(AddItemComponent);

      fixture.componentInstance.onTitleChanged('Breaking');
      await vi.advanceTimersByTimeAsync(400);
      fixture.componentInstance.onTitleChanged('Breaking ');
      await vi.advanceTimersByTimeAsync(400);

      expect(search).toHaveBeenCalledTimes(1);
      expect(search).toHaveBeenCalledWith('Breaking');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not run a pending debounced search after selecting a suggestion', async () => {
    vi.useFakeTimers();
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const search = vi.mocked(suggestionSearchService.search);
    try {
      const fixture = TestBed.createComponent(AddItemComponent);

      fixture.componentInstance.suggestions.set([
        createSuggestion({ id: 1396, title: 'Breaking Bad', type: 'series', year: '2008' }),
      ]);
      fixture.componentInstance.onTitleChanged('Breakin');
      await vi.advanceTimersByTimeAsync(100);
      fixture.componentInstance.onSuggestionSelected(
        createSuggestion({ id: 1396, title: 'Breaking Bad', type: 'series', year: '2008' }),
      );
      await vi.advanceTimersByTimeAsync(400);

      expect(search).not.toHaveBeenCalled();
      expect(fixture.componentInstance.title()).toBe('Breaking Bad');
      expect(fixture.componentInstance.suggestions()).toEqual([]);
      expect(fixture.componentInstance.suggestionsLoading()).toBe(false);
      expect(fixture.componentInstance.suggestionsError()).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});
