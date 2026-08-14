import { TestBed } from '@angular/core/testing';
import { Group } from '../../models/group.model';
import { TmdbSuggestionService } from '../../services/tmdb-suggestion.service';
import { ImageStorageService } from '../../services/image-storage.service';
import { ItemFormComponent } from './item-form.component';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';

describe('ItemFormComponent', () => {
  const groups: Group[] = [
    {
      id: 'ungrouped',
      name: 'Ungrouped',
      order: 0,
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TmdbSuggestionService,
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
          },
        },
      ],
    });
  });

  it('applies the selected status color on first render', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('initialValue', {
      title: 'Completed Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'completed',
      season: 1,
      episode: 8,
      seasons: [{ seasonNumber: 1, totalEpisodes: 10 }],
      startImmediately: false,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const completedButton = buttons.find((button) => button.textContent?.trim() === 'Completed');

    expect(completedButton).toBeDefined();
    expect(completedButton?.className).toContain('bg-status-completed-bg-light');
    expect(completedButton?.className).toContain('border-transparent');
  });

  it('disables submit when pristine if configured', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('disableSubmitWhenPristine', true);
    fixture.componentRef.setInput('initialValue', {
      title: 'Completed Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'completed',
      season: 1,
      episode: 8,
      seasons: [{ seasonNumber: 1, totalEpisodes: 10 }],
      startImmediately: false,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it('shows the duplicate title hint when provided', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput(
      'duplicateTitleHint',
      'An item named "Existing Show" already exists.',
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'An item named "Existing Show" already exists.',
    );
  });

  it('does not show a duplicate title hint by default', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('already exists');
  });

  it('renders TMDB suggestions and applies the selected title and type', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('suggestions', [
      {
        tmdbId: 11,
        title: 'Star Wars',
        type: 'movie',
        year: '1977',
        overview: 'A space opera.',
      },
    ]);
    const selected: unknown[] = [];
    fixture.componentInstance.suggestionSelected.subscribe((suggestion) =>
      selected.push(suggestion),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const suggestionButton = buttons.find((button) => button.textContent?.includes('Star Wars'));

    expect(suggestionButton).toBeDefined();
    suggestionButton?.click();

    expect(fixture.componentInstance.formValue().title).toBe('Star Wars');
    expect(fixture.componentInstance.formValue().type).toBe('movie');
    expect(selected).toEqual([
      {
        tmdbId: 11,
        title: 'Star Wars',
        type: 'movie',
        year: '1977',
        overview: 'A space opera.',
      },
    ]);
  });

  it('updates seasons via updateSeasons', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('initialValue', {
      title: 'Weekly Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'in-progress',
      season: 1,
      episode: 1,
      seasons: [{ seasonNumber: 1, totalEpisodes: 10 }],
      startImmediately: false,
    });

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.updateSeasons([
      { seasonNumber: 1, totalEpisodes: 10, firstEpisodeAirDate: '2026-05-01' },
    ]);

    expect(fixture.componentInstance.formValue().seasons[0].firstEpisodeAirDate).toBe('2026-05-01');
  });

  it('applies an autofill patch once when the patch id changes', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('initialValue', {
      title: 'Weekly Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'not-started',
      season: 1,
      episode: 1,
      seasons: [],
      startImmediately: false,
    });

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('autofillPatch', {
      id: 1,
      value: {
        seasons: [
          {
            seasonNumber: 1,
            totalEpisodes: 10,
            firstEpisodeAirDate: '2026-05-01',
          },
        ],
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.formValue().seasons).toEqual([
      {
        seasonNumber: 1,
        totalEpisodes: 10,
        firstEpisodeAirDate: '2026-05-01',
      },
    ]);
  });

  it('searches TMDB for posters after debounce', async () => {
    vi.useFakeTimers();
    const tmdbSuggestionService = TestBed.inject(TmdbSuggestionService);
    const search = vi.mocked(tmdbSuggestionService.search);
    try {
      search.mockReturnValue(
        of([
          {
            tmdbId: 1,
            title: 'Test Movie',
            type: 'movie',
            posterPath: '/poster.jpg',
          },
        ]),
      );

      const fixture = TestBed.createComponent(ItemFormComponent);
      fixture.componentRef.setInput('groups', groups);
      fixture.detectChanges();

      fixture.componentInstance.onPosterSearchChanged('test');
      await vi.advanceTimersByTimeAsync(300);

      expect(search).toHaveBeenCalledWith('test');
      expect(fixture.componentInstance.posterSuggestions()).toEqual([
        {
          tmdbId: 1,
          title: 'Test Movie',
          type: 'movie',
          posterPath: '/poster.jpg',
        },
      ]);
      expect(fixture.componentInstance.posterSuggestionsLoading()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('filters out poster suggestions without posterPath', async () => {
    vi.useFakeTimers();
    const tmdbSuggestionService = TestBed.inject(TmdbSuggestionService);
    const search = vi.mocked(tmdbSuggestionService.search);
    try {
      search.mockReturnValue(
        of([
          {
            tmdbId: 1,
            title: 'With Poster',
            type: 'movie',
            posterPath: '/poster.jpg',
          },
          {
            tmdbId: 2,
            title: 'No Poster',
            type: 'movie',
          },
        ]),
      );

      const fixture = TestBed.createComponent(ItemFormComponent);
      fixture.componentRef.setInput('groups', groups);
      fixture.detectChanges();

      fixture.componentInstance.onPosterSearchChanged('test');
      await vi.advanceTimersByTimeAsync(300);

      expect(fixture.componentInstance.posterSuggestions()).toEqual([
        {
          tmdbId: 1,
          title: 'With Poster',
          type: 'movie',
          posterPath: '/poster.jpg',
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not search for poster with query shorter than 2 characters', async () => {
    vi.useFakeTimers();
    const tmdbSuggestionService = TestBed.inject(TmdbSuggestionService);
    const search = vi.mocked(tmdbSuggestionService.search);
    try {
      const fixture = TestBed.createComponent(ItemFormComponent);
      fixture.componentRef.setInput('groups', groups);
      fixture.detectChanges();

      fixture.componentInstance.onPosterSearchChanged('a');
      await vi.advanceTimersByTimeAsync(300);

      expect(search).not.toHaveBeenCalled();
      expect(fixture.componentInstance.posterSuggestions()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sets poster path on the form when selecting a TMDB poster suggestion', async () => {
    vi.useFakeTimers();
    const tmdbSuggestionService = TestBed.inject(TmdbSuggestionService);
    const search = vi.mocked(tmdbSuggestionService.search);
    try {
      search.mockReturnValue(
        of([
          {
            tmdbId: 1,
            title: 'Test Movie',
            type: 'movie',
            posterPath: '/new-poster.jpg',
          },
        ]),
      );

      const fixture = TestBed.createComponent(ItemFormComponent);
      fixture.componentRef.setInput('groups', groups);
      fixture.detectChanges();

      fixture.componentInstance.onPosterSearchChanged('test');
      await vi.advanceTimersByTimeAsync(300);

      fixture.componentInstance.selectPosterFromTmdb({
        tmdbId: 1,
        title: 'Test Movie',
        type: 'movie',
        posterPath: '/new-poster.jpg',
      });

      await Promise.resolve();
      await Promise.resolve();
      expect(fixture.componentInstance.formValue().posterId).toBe('image-1');
      expect(fixture.componentInstance.posterSearchQuery()).toBe('');
      expect(fixture.componentInstance.posterSuggestions()).toEqual([]);
      expect(fixture.componentInstance.showPosterSearch()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not render a manual poster URL import control', () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[name="posterUrl"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Use URL');
  });

  it('stores the poster when selecting an item suggestion', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.detectChanges();

    fixture.componentInstance.selectSuggestion({
      tmdbId: 1,
      title: 'Test Movie',
      type: 'movie',
      posterPath: '/poster.jpg',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(fixture.componentInstance.formValue().posterId).toBe('image-1');
  });

  it('blocks submission while a poster is being saved', () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentInstance.updateTitle('Test Movie');
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentInstance.posterLoading.set(true);

    fixture.componentInstance.submit();

    expect(fixture.componentInstance.isSubmitDisabled()).toBe(true);
    expect(submitted).not.toHaveBeenCalled();
  });

  it('deletes a poster that finishes importing after it was cleared', async () => {
    let resolvePoster!: (id: string) => void;
    const imageStorage = TestBed.inject(ImageStorageService);
    vi.mocked(imageStorage.storeUrl).mockReturnValue(
      new Promise<string>((resolve) => {
        resolvePoster = resolve;
      }),
    );
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.detectChanges();

    fixture.componentInstance.selectPosterFromTmdb({
      tmdbId: 1,
      title: 'Test Movie',
      type: 'movie',
      posterPath: '/poster.jpg',
    });
    fixture.componentInstance.clearPoster();
    resolvePoster('late-poster');
    await Promise.resolve();
    await Promise.resolve();

    expect(imageStorage.delete).toHaveBeenCalledWith('late-poster');
    expect(fixture.componentInstance.formValue().posterId).toBeUndefined();
  });

  it('re-triggers poster search when re-typing the same query after selection', async () => {
    vi.useFakeTimers();
    const tmdbSuggestionService = TestBed.inject(TmdbSuggestionService);
    const search = vi.mocked(tmdbSuggestionService.search);
    try {
      search.mockReturnValue(
        of([
          {
            tmdbId: 1,
            title: 'Test Movie',
            type: 'movie',
            posterPath: '/poster.jpg',
          },
        ]),
      );

      const fixture = TestBed.createComponent(ItemFormComponent);
      fixture.componentRef.setInput('groups', groups);
      fixture.detectChanges();

      fixture.componentInstance.onPosterSearchChanged('batman');
      await vi.advanceTimersByTimeAsync(300);
      expect(search).toHaveBeenCalledTimes(1);

      fixture.componentInstance.selectPosterFromTmdb({
        tmdbId: 1,
        title: 'Test Movie',
        type: 'movie',
        posterPath: '/poster.jpg',
      });

      fixture.componentInstance.onPosterSearchChanged('batman');
      await vi.advanceTimersByTimeAsync(300);
      expect(search).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows TMDB error when poster search fails', async () => {
    vi.useFakeTimers();
    const tmdbSuggestionService = TestBed.inject(TmdbSuggestionService);
    const search = vi.mocked(tmdbSuggestionService.search);
    try {
      search.mockReturnValue(throwError(() => new Error('TMDB unavailable')));

      const fixture = TestBed.createComponent(ItemFormComponent);
      fixture.componentRef.setInput('groups', groups);
      fixture.detectChanges();

      fixture.componentInstance.onPosterSearchChanged('test');
      await vi.advanceTimersByTimeAsync(300);

      expect(fixture.componentInstance.posterSuggestionsError()).toBe('TMDB search unavailable.');
      expect(fixture.componentInstance.posterSuggestionsLoading()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
