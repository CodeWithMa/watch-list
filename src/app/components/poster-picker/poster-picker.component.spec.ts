import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createSuggestionProviders } from '../../services/suggestion-search.test-utils';
import { ImageStorageService } from '../../services/image-storage.service';
import { ProviderSettingsService } from '../../services/provider-settings.service';
import { PosterPickerComponent } from './poster-picker.component';
import { Suggestion, SuggestionSource } from '../../models/suggestion.model';
import { afterEach, vi } from 'vitest';
import { Subject, of, throwError } from 'rxjs';

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
  let suggestionSearchService: ReturnType<typeof createSuggestionProviders>;
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    suggestionSearchService = createSuggestionProviders();
    TestBed.configureTestingModule({
      providers: [
        ...suggestionSearchService.providers,
        {
          provide: ImageStorageService,
          useValue: {
            getUrl: vi.fn(() => Promise.resolve(null)),
            storeUrl: vi.fn(() => Promise.resolve('image-1')),
            storeFile: vi.fn(() => Promise.resolve('image-1')),
            discardDraft: vi.fn(),
            version: signal(0).asReadonly(),
          },
        },
      ],
    });
    const settings = TestBed.inject(ProviderSettingsService);
    for (const source of ['tmdb', 'jikan', 'anilist'] as const) {
      settings.setEnabled(source, true);
    }
  });

  it('switches poster search providers without allowing stale results to reappear', async () => {
    vi.useFakeTimers();
    try {
      const search = suggestionSearchService.search;
      const lateResults = new Subject<Suggestion[]>();
      const oldResult = createSuggestion({
        id: 1,
        title: 'Old poster result',
        type: 'movie',
        posterUrl: 'https://example.com/old.jpg',
      });
      const newResult = createSuggestion({
        source: 'anilist',
        id: 2,
        title: 'New poster result',
        type: 'movie',
        posterUrl: 'https://example.com/new.jpg',
      });
      search
        .mockReturnValueOnce(of([oldResult]))
        .mockReturnValueOnce(lateResults)
        .mockReturnValueOnce(of([newResult]));
      const fixture = TestBed.createComponent(PosterPickerComponent);
      const root = fixture.nativeElement as HTMLElement;
      fixture.componentRef.setInput('searchSeed', 'Naruto');
      fixture.componentInstance.openPosterSearch();
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(400);
      fixture.detectChanges();
      expect(search).toHaveBeenLastCalledWith('Naruto', 'tmdb');
      expect(root.textContent).toContain('Old poster result');

      const query = root.querySelector<HTMLInputElement>('input[name="posterSearch"]')!;
      query.value = 'Naruto Shippuden';
      query.dispatchEvent(new Event('input'));
      await vi.advanceTimersByTimeAsync(400);

      const provider = root.querySelector<HTMLButtonElement>(
        'button[aria-label="Poster search provider: TMDB"]',
      )!;
      expect(
        provider.compareDocumentPosition(query) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      provider.click();
      fixture.detectChanges();
      const options = [...root.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
      expect(options.map((option) => option.textContent?.replace('✓', '').trim())).toEqual([
        'TMDB',
        'Jikan',
        'AniList',
      ]);
      options[2].click();
      fixture.detectChanges();
      expect(provider.querySelector('img')?.getAttribute('src')).toBe(
        'icons/providers/anilist.svg',
      );
      expect(provider.getAttribute('aria-label')).toBe('Poster search provider: AniList');
      expect(root.textContent).not.toContain('Old poster result');
      lateResults.next([oldResult]);
      lateResults.complete();
      fixture.detectChanges();
      expect(root.textContent).not.toContain('Old poster result');

      await vi.advanceTimersByTimeAsync(400);
      fixture.detectChanges();
      expect(search).toHaveBeenLastCalledWith('Naruto Shippuden', 'anilist');
      expect(root.textContent).toContain('New poster result');
    } finally {
      vi.useRealTimers();
    }
  });

  it.each<{ sources: SuggestionSource[] }>([
    { sources: ['anilist'] },
    { sources: ['jikan', 'anilist'] },
    { sources: [] },
  ])('uses enabled poster search providers: $sources', async ({ sources }) => {
    vi.useFakeTimers();
    try {
      const settings = TestBed.inject(ProviderSettingsService);
      for (const source of ['tmdb', 'jikan', 'anilist'] as const) {
        settings.setEnabled(source, sources.includes(source));
      }
      const search = suggestionSearchService.search;
      const fixture = TestBed.createComponent(PosterPickerComponent);
      const root = fixture.nativeElement as HTMLElement;
      fixture.componentRef.setInput('searchSeed', 'Naruto');
      fixture.componentInstance.openPosterSearch();
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(400);

      const provider = root.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
      if (sources.length > 1) {
        expect(provider!.getAttribute('aria-label')).toBe('Poster search provider: Jikan');
        provider!.click();
        fixture.detectChanges();
        const options = [...root.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
        expect(options.map((option) => option.textContent?.replace('✓', '').trim())).toEqual([
          'Jikan',
          'AniList',
        ]);
        expect(options[0].getAttribute('aria-checked')).toBe('true');
      } else {
        expect(provider).toBeNull();
      }
      if (sources.length) {
        expect(search).toHaveBeenCalledWith('Naruto', sources[0]);
      } else {
        expect(search).not.toHaveBeenCalled();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('seeds poster search with the item title when opened', async () => {
    vi.useFakeTimers();
    const search = vi.mocked(suggestionSearchService.search);
    try {
      const fixture = TestBed.createComponent(PosterPickerComponent);
      fixture.componentRef.setInput('searchSeed', ' Test Movie ');
      fixture.detectChanges();

      fixture.componentInstance.openPosterSearch();

      expect(fixture.componentInstance.showPosterSearch()).toBe(true);
      expect(fixture.componentInstance.posterSearchQuery()).toBe('Test Movie');

      await vi.advanceTimersByTimeAsync(400);
      expect(search).toHaveBeenCalledWith('Test Movie', 'tmdb');
    } finally {
      vi.useRealTimers();
    }
  });

  it('searches for posters after debounce', async () => {
    vi.useFakeTimers();
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

      expect(search).toHaveBeenCalledWith('test', 'tmdb');
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

  it('opens the image picker exactly once from a keyboard-focusable Upload button', () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    fixture.detectChanges();

    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.trim() === 'Upload image',
    ) as HTMLButtonElement | undefined;
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('type')).toBe('button');
    // The file input must not be nested in a label: label activation plus an
    // explicit .click() would open the picker twice.
    expect(fixture.nativeElement.querySelector('label input[type="file"]')).toBeNull();

    const input = fixture.nativeElement.querySelector(
      'input[type="file"][accept="image/*"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click').mockReturnValue(undefined);
    button?.click();

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it.each(['change', 'cancel'])(
    'requests window focus on %s with no file without changing the poster',
    async (event) => {
      const focus = vi.spyOn(window, 'focus').mockReturnValue(undefined);
      const fixture = TestBed.createComponent(PosterPickerComponent);
      fixture.detectChanges();
      const changed = vi.fn();
      fixture.componentInstance.posterIdChange.subscribe(changed);
      const root = fixture.nativeElement as HTMLElement;
      const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
      input.dispatchEvent(new Event(event, { bubbles: true }));
      await fixture.whenStable();

      expect(focus).toHaveBeenCalledOnce();
      expect(TestBed.inject(ImageStorageService).storeFile).not.toHaveBeenCalled();
      expect(changed).not.toHaveBeenCalled();
    },
  );

  it('requests window focus when a poster is selected, before image storage finishes', async () => {
    const focus = vi.spyOn(window, 'focus').mockReturnValue(undefined);
    const imageStorage = TestBed.inject(ImageStorageService);
    let resolvePoster!: (id: string) => void;
    vi.mocked(imageStorage.storeFile).mockReturnValue(
      new Promise<string>((resolve) => {
        resolvePoster = resolve;
      }),
    );
    const fixture = TestBed.createComponent(PosterPickerComponent);
    fixture.detectChanges();
    const changed = vi.fn();
    fixture.componentInstance.posterIdChange.subscribe(changed);
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['image'], 'poster.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(focus).toHaveBeenCalledOnce();
    expect(imageStorage.storeFile).toHaveBeenCalledWith(file, { provisional: true });
    expect(changed).not.toHaveBeenCalled();

    resolvePoster('image-1');
    await fixture.whenStable();
    expect(changed).toHaveBeenCalledWith('image-1');
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

    expect(imageStorage.discardDraft).toHaveBeenCalledWith('late-poster');
  });

  it('re-triggers poster search when re-typing the same query after selection', async () => {
    vi.useFakeTimers();
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

    expect(imageStorage.storeFile).toHaveBeenCalledWith(file, { provisional: true });
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
    expect(imageStorage.discardDraft).toHaveBeenCalledWith('image-1');
    expect(emitted.at(-1)).toBeUndefined();
    expect(fixture.componentInstance.posterLoading()).toBe(false);
    expect(loading.at(-1)).toBe(false);
  });

  it('releases drafts on destroy without deciding persistent ownership', async () => {
    const fixture = TestBed.createComponent(PosterPickerComponent);
    const imageStorage = TestBed.inject(ImageStorageService);
    fixture.detectChanges();

    fixture.componentInstance.storeFromUrl('https://example.com/a.jpg');
    await Promise.resolve();
    await Promise.resolve();

    fixture.destroy();
    expect(imageStorage.discardDraft).toHaveBeenCalledWith('image-1');
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
    expect(imageStorage.discardDraft).toHaveBeenCalled();
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

    expect(imageStorage.discardDraft).toHaveBeenCalledWith('old-id');
  });

  it('loads poster preview on input change', async () => {
    const versionSignal = signal(0);
    TestBed.resetTestingModule();
    const getUrl = vi.fn(() => Promise.resolve('blob:preview'));
    TestBed.configureTestingModule({
      providers: [
        ...suggestionSearchService.providers,
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
        ...suggestionSearchService.providers,
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

    vi.mocked(imageStorage.discardDraft).mockClear();
    fixture.destroy();
    expect(imageStorage.discardDraft).toHaveBeenCalled();
  });
});
