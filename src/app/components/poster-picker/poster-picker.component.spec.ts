import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SuggestionSearchService } from '../../services/suggestion-search.service';
import { ImageStorageService } from '../../services/image-storage.service';
import { PosterPickerComponent } from './poster-picker.component';
import { Suggestion, SuggestionSource } from '../../models/suggestion.model';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';

function createSuggestion(
  overrides: Partial<Suggestion> & Pick<Suggestion, 'id' | 'title' | 'type'>,
): Suggestion {
  return {
    source: 'tmdb' as SuggestionSource,
    ...overrides,
  };
}

describe('PosterPickerComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SuggestionSearchService,
          useValue: {
            search: vi.fn(() => of([])),
          },
        },
        {
          provide: ImageStorageService,
          useValue: {
            getUrl: vi.fn(() => Promise.resolve(null)),
            storeUrl: vi.fn(() => Promise.resolve('image-1')),
            storeFile: vi.fn(() => Promise.resolve('image-1')),
            delete: vi.fn(() => Promise.resolve()),
            version: signal(0).asReadonly(),
          },
        },
      ],
    });
  });

  it('seeds poster search with the item title when opened', async () => {
    vi.useFakeTimers();
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const search = vi.mocked(suggestionSearchService.search);
    try {
      const fixture = TestBed.createComponent(PosterPickerComponent);
      fixture.componentRef.setInput('searchSeed', ' Test Movie ');
      fixture.detectChanges();

      fixture.componentInstance.openPosterSearch();

      expect(fixture.componentInstance.showPosterSearch()).toBe(true);
      expect(fixture.componentInstance.posterSearchQuery()).toBe('Test Movie');

      await vi.advanceTimersByTimeAsync(400);
      expect(search).toHaveBeenCalledWith('Test Movie');
    } finally {
      vi.useRealTimers();
    }
  });

  it('searches for posters after debounce', async () => {
    vi.useFakeTimers();
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const search = vi.mocked(suggestionSearchService.search);
    try {
      search.mockReturnValue(
        of([
          createSuggestion({
            id: 1,
            title: 'Test Movie',
            type: 'movie',
            posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
          }),
        ]),
      );

      const fixture = TestBed.createComponent(PosterPickerComponent);
      fixture.detectChanges();

      fixture.componentInstance.onPosterSearchChanged('test');
      await vi.advanceTimersByTimeAsync(400);

      expect(search).toHaveBeenCalledWith('test');
      expect(fixture.componentInstance.posterSuggestions()).toEqual([
        createSuggestion({
          id: 1,
          title: 'Test Movie',
          type: 'movie',
          posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
        }),
      ]);
      expect(fixture.componentInstance.posterSuggestionsLoading()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('filters out poster suggestions without posterUrl', async () => {
    vi.useFakeTimers();
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const search = vi.mocked(suggestionSearchService.search);
    try {
      search.mockReturnValue(
        of([
          createSuggestion({
            id: 1,
            title: 'With Poster',
            type: 'movie',
            posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
          }),
          createSuggestion({ id: 2, title: 'No Poster', type: 'movie' }),
        ]),
      );

      const fixture = TestBed.createComponent(PosterPickerComponent);
      fixture.detectChanges();

      fixture.componentInstance.onPosterSearchChanged('test');
      await vi.advanceTimersByTimeAsync(400);

      expect(fixture.componentInstance.posterSuggestions()).toEqual([
        createSuggestion({
          id: 1,
          title: 'With Poster',
          type: 'movie',
          posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
        }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not search for poster with query shorter than 2 characters', async () => {
    vi.useFakeTimers();
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const search = vi.mocked(suggestionSearchService.search);
    try {
      const fixture = TestBed.createComponent(PosterPickerComponent);
      fixture.detectChanges();

      fixture.componentInstance.onPosterSearchChanged('a');
      await vi.advanceTimersByTimeAsync(400);

      expect(search).not.toHaveBeenCalled();
      expect(fixture.componentInstance.posterSuggestions()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stores the poster when selecting a poster suggestion', async () => {
    vi.useFakeTimers();
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const search = vi.mocked(suggestionSearchService.search);
    try {
      search.mockReturnValue(
        of([
          createSuggestion({
            id: 1,
            title: 'Test Movie',
            type: 'movie',
            posterUrl: 'https://image.tmdb.org/t/p/w342/new-poster.jpg',
          }),
        ]),
      );

      const fixture = TestBed.createComponent(PosterPickerComponent);
      fixture.detectChanges();

      fixture.componentInstance.onPosterSearchChanged('test');
      await vi.advanceTimersByTimeAsync(400);

      const emitted: (string | undefined)[] = [];
      fixture.componentInstance.posterIdChange.subscribe((posterId) => emitted.push(posterId));

      fixture.componentInstance.selectPosterSuggestion(
        createSuggestion({
          id: 1,
          title: 'Test Movie',
          type: 'movie',
          posterUrl: 'https://image.tmdb.org/t/p/w342/new-poster.jpg',
        }),
      );

      await Promise.resolve();
      await Promise.resolve();
      expect(emitted).toEqual(['image-1']);
      expect(fixture.componentInstance.posterSearchQuery()).toBe('');
      expect(fixture.componentInstance.posterSuggestions()).toEqual([]);
      expect(fixture.componentInstance.showPosterSearch()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not render a manual poster URL import control', () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[name="posterUrl"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Use URL');
  });

  it('stores the poster from a suggestion URL', async () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    fixture.detectChanges();

    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.posterIdChange.subscribe((posterId) => emitted.push(posterId));

    fixture.componentInstance.storeFromUrl('https://image.tmdb.org/t/p/w342/poster.jpg');
    await Promise.resolve();
    await Promise.resolve();

    expect(emitted).toEqual(['image-1']);
  });

  it('reports loading while a poster is being saved', async () => {
    let resolvePoster!: (id: string) => void;
    const imageStorage = TestBed.inject(ImageStorageService);
    vi.mocked(imageStorage.storeUrl).mockReturnValue(
      new Promise<string>((resolve) => {
        resolvePoster = resolve;
      }),
    );
    const fixture = TestBed.createComponent(PosterPickerComponent);
    fixture.detectChanges();

    const loading: boolean[] = [];
    fixture.componentInstance.loadingChange.subscribe((value) => loading.push(value));

    fixture.componentInstance.storeFromUrl('https://image.tmdb.org/t/p/w342/poster.jpg');
    await Promise.resolve();

    expect(fixture.componentInstance.posterLoading()).toBe(true);
    expect(loading).toContain(true);

    resolvePoster('image-1');
    await Promise.resolve();
    await Promise.resolve();

    expect(fixture.componentInstance.posterLoading()).toBe(false);
    expect(loading.at(-1)).toBe(false);
  });

  it('deletes a poster that finishes importing after it was cleared', async () => {
    let resolvePoster!: (id: string) => void;
    const imageStorage = TestBed.inject(ImageStorageService);
    vi.mocked(imageStorage.storeUrl).mockReturnValue(
      new Promise<string>((resolve) => {
        resolvePoster = resolve;
      }),
    );
    const fixture = TestBed.createComponent(PosterPickerComponent);
    fixture.detectChanges();

    fixture.componentInstance.selectPosterSuggestion(
      createSuggestion({
        id: 1,
        title: 'Test Movie',
        type: 'movie',
        posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
      }),
    );
    fixture.componentInstance.clearPoster();
    resolvePoster('late-poster');
    await Promise.resolve();
    await Promise.resolve();

    expect(imageStorage.delete).toHaveBeenCalledWith('late-poster');
  });

  it('re-triggers poster search when re-typing the same query after selection', async () => {
    vi.useFakeTimers();
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const search = vi.mocked(suggestionSearchService.search);
    try {
      search.mockReturnValue(
        of([
          createSuggestion({
            id: 1,
            title: 'Test Movie',
            type: 'movie',
            posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
          }),
        ]),
      );

      const fixture = TestBed.createComponent(PosterPickerComponent);
      fixture.detectChanges();

      fixture.componentInstance.onPosterSearchChanged('batman');
      await vi.advanceTimersByTimeAsync(400);
      expect(search).toHaveBeenCalledTimes(1);

      fixture.componentInstance.selectPosterSuggestion(
        createSuggestion({
          id: 1,
          title: 'Test Movie',
          type: 'movie',
          posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
        }),
      );

      fixture.componentInstance.onPosterSearchChanged('batman');
      await vi.advanceTimersByTimeAsync(400);
      expect(search).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows error when poster search fails', async () => {
    vi.useFakeTimers();
    const suggestionSearchService = TestBed.inject(SuggestionSearchService);
    const search = vi.mocked(suggestionSearchService.search);
    try {
      search.mockReturnValue(throwError(() => new Error('search unavailable')));

      const fixture = TestBed.createComponent(PosterPickerComponent);
      fixture.detectChanges();

      fixture.componentInstance.onPosterSearchChanged('test');
      await vi.advanceTimersByTimeAsync(400);

      expect(fixture.componentInstance.posterSuggestionsError()).toBe('Search unavailable.');
      expect(fixture.componentInstance.posterSuggestionsLoading()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
