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
    isAdult: false,
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

  it('opens poster search without seed and with whitespace seed', async () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(PosterPickerComponent);
      fixture.componentRef.setInput('searchSeed', '   ');
      fixture.detectChanges();

      fixture.componentInstance.openPosterSearch();
      expect(fixture.componentInstance.showPosterSearch()).toBe(true);
      expect(fixture.componentInstance.posterSearchQuery()).toBe('');

      // with no seed
      const fixture2 = TestBed.createComponent(PosterPickerComponent);
      fixture2.componentRef.setInput('searchSeed', '');
      fixture2.detectChanges();
      fixture2.componentInstance.openPosterSearch();
      expect(fixture2.componentInstance.showPosterSearch()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not store poster when suggestion has no posterUrl', async () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    const imageStorage = TestBed.inject(ImageStorageService);
    fixture.detectChanges();

    fixture.componentInstance.selectPosterSuggestion(
      createSuggestion({ id: 1, title: 'No Poster', type: 'movie' }),
    );

    expect(imageStorage.storeUrl).not.toHaveBeenCalled();
    expect(fixture.componentInstance.showPosterSearch()).toBe(false);
  });

  it('ignores storeFromUrl when url is null or empty', () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    const imageStorage = TestBed.inject(ImageStorageService);
    fixture.detectChanges();

    fixture.componentInstance.storeFromUrl(null as unknown as string);
    fixture.componentInstance.storeFromUrl(undefined as unknown as string);
    fixture.componentInstance.storeFromUrl('');
    expect(imageStorage.storeUrl).not.toHaveBeenCalled();
  });

  it('uploads poster file and resets input', async () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    const imageStorage = TestBed.inject(ImageStorageService);
    fixture.detectChanges();

    const file = new File(['img'], 'poster.png', { type: 'image/png' });
    const input = { files: [file], value: 'some' } as unknown as HTMLInputElement;
    const event = { target: input } as unknown as Event;

    await fixture.componentInstance.uploadPoster(event);

    expect(imageStorage.storeFile).toHaveBeenCalledWith(file);
    expect(input.value).toBe('');
  });

  it('does nothing when upload has no file', async () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    const imageStorage = TestBed.inject(ImageStorageService);
    fixture.detectChanges();

    const input = { files: [], value: 'x' } as unknown as HTMLInputElement;
    const event = { target: input } as unknown as Event;

    await fixture.componentInstance.uploadPoster(event);
    expect(imageStorage.storeFile).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('clears poster and deletes draft', async () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    const imageStorage = TestBed.inject(ImageStorageService);
    fixture.componentRef.setInput('posterId', 'image-1');
    fixture.detectChanges();

    // Simulate that draftPosterIds contains image-1
    (fixture.componentInstance as unknown as { draftPosterIds: Set<string> }).draftPosterIds.add(
      'image-1',
    );

    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.posterIdChange.subscribe((v) => emitted.push(v));
    const loading: boolean[] = [];
    fixture.componentInstance.loadingChange.subscribe((v) => loading.push(v));

    fixture.componentInstance.clearPoster();
    expect(imageStorage.delete).toHaveBeenCalledWith('image-1');
    expect(emitted.at(-1)).toBeUndefined();
    expect(fixture.componentInstance.posterLoading()).toBe(false);
    expect(loading.at(-1)).toBe(false);
  });

  it('commits drafts prevents cleanup on destroy', async () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    const imageStorage = TestBed.inject(ImageStorageService);
    fixture.detectChanges();

    fixture.componentInstance.storeFromUrl('https://example.com/a.jpg');
    await Promise.resolve();
    await Promise.resolve();

    fixture.componentInstance.commitDrafts();
    vi.mocked(imageStorage.delete).mockClear();
    fixture.destroy();
    // Should not delete because skipDraftCleanup true
    expect(imageStorage.delete).not.toHaveBeenCalled();
  });

  it('clearDrafts deletes all drafts and emits', async () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    const imageStorage = TestBed.inject(ImageStorageService);
    fixture.detectChanges();

    fixture.componentInstance.storeFromUrl('https://example.com/a.jpg');
    await Promise.resolve();
    await Promise.resolve();

    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.posterIdChange.subscribe((v) => emitted.push(v));

    fixture.componentInstance.clearDrafts();
    expect(imageStorage.delete).toHaveBeenCalled();
    expect(emitted.at(-1)).toBeUndefined();
  });

  it('shows error when storing poster fails', async () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    const imageStorage = TestBed.inject(ImageStorageService);
    vi.mocked(imageStorage.storeUrl).mockReturnValue(Promise.reject(new Error('fail message')));
    fixture.detectChanges();

    fixture.componentInstance.storeFromUrl('https://example.com/a.jpg');
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(fixture.componentInstance.posterError()).toBe('fail message');
    expect(fixture.componentInstance.posterLoading()).toBe(false);
  });

  it('shows generic error for non-Error rejection', async () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    const imageStorage = TestBed.inject(ImageStorageService);
    vi.mocked(imageStorage.storeUrl).mockReturnValue(Promise.reject('string error'));
    fixture.detectChanges();

    fixture.componentInstance.storeFromUrl('https://example.com/a.jpg');
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(fixture.componentInstance.posterError()).toBe('Unable to save poster.');
  });

  it('does not set error when component destroyed before store completes', async () => {
    let reject: (e: Error) => void;
    const fixture = TestBed.createComponent(PosterPickerComponent);
    const imageStorage = TestBed.inject(ImageStorageService);
    vi.mocked(imageStorage.storeUrl).mockReturnValue(
      new Promise<string>((_, rej) => (reject = rej)),
    );
    fixture.detectChanges();

    fixture.componentInstance.storeFromUrl('https://example.com/a.jpg');
    fixture.destroy();
    reject!(new Error('fail'));
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    // Should not throw and not set error because destroyed
    expect(fixture.componentInstance.posterError()).toBe('');
  });

  it('deletes previous draft when new poster stored', async () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    const imageStorage = TestBed.inject(ImageStorageService);
    fixture.componentRef.setInput('posterId', 'old-id');
    fixture.detectChanges();

    // Simulate draft contains old-id
    (fixture.componentInstance as unknown as { draftPosterIds: Set<string> }).draftPosterIds.add(
      'old-id',
    );

    fixture.componentInstance.storeFromUrl('https://example.com/new.jpg');
    await Promise.resolve();
    await Promise.resolve();

    expect(imageStorage.delete).toHaveBeenCalledWith('old-id');
  });

  it('loads poster preview on input change', async () => {
    const versionSignal = signal(0);
    TestBed.resetTestingModule();
    const getUrl = vi.fn(() => Promise.resolve('blob:preview'));
    TestBed.configureTestingModule({
      providers: [
        { provide: SuggestionSearchService, useValue: { search: vi.fn(() => of([])) } },
        {
          provide: ImageStorageService,
          useValue: {
            getUrl,
            storeUrl: vi.fn(() => Promise.resolve('image-1')),
            storeFile: vi.fn(() => Promise.resolve('image-1')),
            delete: vi.fn(() => Promise.resolve()),
            version: versionSignal.asReadonly(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(PosterPickerComponent);
    fixture.componentRef.setInput('posterId', 'p1');
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    await Promise.resolve();
    expect(getUrl).toHaveBeenCalledWith('p1');
    expect(fixture.componentInstance.posterPreviewUrl()).toBe('blob:preview');

    // change version triggers reload
    versionSignal.set(1);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    expect(getUrl).toHaveBeenCalledTimes(2);
  });

  it('does not set preview if destroyed or stale version', async () => {
    let resolveUrl!: (v: string | null) => void;
    const versionSignal = signal(0);
    TestBed.resetTestingModule();
    const getUrl = vi.fn(() => new Promise<string | null>((res) => (resolveUrl = res)));
    TestBed.configureTestingModule({
      providers: [
        { provide: SuggestionSearchService, useValue: { search: vi.fn(() => of([])) } },
        {
          provide: ImageStorageService,
          useValue: {
            getUrl,
            storeUrl: vi.fn(() => Promise.resolve('image-1')),
            storeFile: vi.fn(() => Promise.resolve('image-1')),
            delete: vi.fn(() => Promise.resolve()),
            version: versionSignal.asReadonly(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(PosterPickerComponent);
    fixture.componentRef.setInput('posterId', 'p1');
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));

    // stale version
    versionSignal.set(99);
    resolveUrl('blob:p1');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    // second load with new version will be triggered, but we only resolved first, so first is stale and should not set
    // Need to resolve second as well to get final value, but first should not set
    // For this test, we check that after stale resolve, preview is still null until second resolves
    expect(fixture.componentInstance.posterPreviewUrl()).toBeNull();

    // now destroy case
    const fixture2 = TestBed.createComponent(PosterPickerComponent);
    fixture2.componentRef.setInput('posterId', 'p2');
    fixture2.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    fixture2.destroy();
    resolveUrl('blob:p2');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(fixture2.componentInstance.posterPreviewUrl()).toBeNull();
  });

  it('cleans up drafts on destroy', async () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    const imageStorage = TestBed.inject(ImageStorageService);
    fixture.detectChanges();

    fixture.componentInstance.storeFromUrl('https://example.com/a.jpg');
    await Promise.resolve();
    await Promise.resolve();

    vi.mocked(imageStorage.delete).mockClear();
    fixture.destroy();
    expect(imageStorage.delete).toHaveBeenCalled();
  });
});
