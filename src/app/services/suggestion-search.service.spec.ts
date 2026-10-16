import { TestBed } from '@angular/core/testing';
import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SuggestionSearchService } from './suggestion-search.service';
import { AnilistSuggestionService } from './anilist-suggestion.service';
import { JikanSuggestionService } from './jikan-suggestion.service';
import { ProviderSettingsService } from './provider-settings.service';
import { TmdbSuggestionService } from './tmdb-suggestion.service';
import { Suggestion, SuggestionSource } from '../models/suggestion.model';

function sug(overrides: Partial<Suggestion> & Pick<Suggestion, 'id' | 'title'>): Suggestion {
  return {
    source: 'tmdb',
    type: 'series',
    isAdult: false,
    ...overrides,
  } as Suggestion;
}

describe('SuggestionSearchService', () => {
  let tmdb: { search: ReturnType<typeof vi.fn>; getSeriesDetails: ReturnType<typeof vi.fn> };
  let jikan: { search: ReturnType<typeof vi.fn>; getAnimeDetails: ReturnType<typeof vi.fn> };
  let anilist: { search: ReturnType<typeof vi.fn>; getAnimeDetails: ReturnType<typeof vi.fn> };
  let provider: {
    isEnabled: ReturnType<typeof vi.fn>;
    isAnyEnabled: ReturnType<typeof vi.fn>;
    getEnabledSources: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    tmdb = {
      search: vi.fn(() => of([])),
      getSeriesDetails: vi.fn(() => of(null)),
    };
    jikan = {
      search: vi.fn(() => of([])),
      getAnimeDetails: vi.fn(() => of(null)),
    };
    anilist = {
      search: vi.fn(() => of([])),
      getAnimeDetails: vi.fn(() => of(null)),
    };
    provider = {
      isEnabled: vi.fn(() => true),
      isAnyEnabled: vi.fn(() => true),
      getEnabledSources: vi.fn(() => ['tmdb', 'jikan', 'anilist']),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: TmdbSuggestionService, useValue: tmdb },
        { provide: JikanSuggestionService, useValue: jikan },
        { provide: AnilistSuggestionService, useValue: anilist },
        { provide: ProviderSettingsService, useValue: provider },
      ],
    });
  });

  it('returns empty for queries shorter than min length', () => {
    const service = TestBed.inject(SuggestionSearchService);
    let result: Suggestion[] | undefined;
    service.search('a').subscribe((r) => (result = r));
    expect(result).toEqual([]);
    expect(tmdb.search).not.toHaveBeenCalled();
  });

  it('trims query and enforces min length', () => {
    const service = TestBed.inject(SuggestionSearchService);
    let result: Suggestion[] | undefined;
    service.search('  a  ').subscribe((r) => (result = r));
    expect(result).toEqual([]);
    expect(tmdb.search).not.toHaveBeenCalled();
  });

  it.each<SuggestionSource>(['tmdb', 'jikan', 'anilist'])(
    'searches only the selected %s provider with the trimmed query',
    (source) => {
      const service = TestBed.inject(SuggestionSearchService);
      const results = [sug({ source, id: 1, title: 'Selected result' })];
      const services = { tmdb, jikan, anilist };
      services[source].search.mockReturnValue(of(results));

      let result: Suggestion[] = [];
      service.search('  test  ', source).subscribe((r) => (result = r));

      expect(result).toEqual(results);
      expect(services[source].search).toHaveBeenCalledWith('test');
      for (const other of ['tmdb', 'jikan', 'anilist'] as const) {
        if (other !== source) expect(services[other].search).not.toHaveBeenCalled();
      }
    },
  );

  it('reports provider failures without disguising them as empty results or falling back', () => {
    const service = TestBed.inject(SuggestionSearchService);
    tmdb.search.mockReturnValue(throwError(() => new Error('fail')));
    jikan.search.mockReturnValue(of([sug({ id: 2, title: 'jikan' })]));
    anilist.search.mockReturnValue(throwError(() => new Error('fail')));

    const next = vi.fn();
    const error = vi.fn();
    service.search('test').subscribe({ next, error });
    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(new Error('fail'));
    expect(jikan.search).not.toHaveBeenCalled();
  });

  it('defaults to the first enabled provider', () => {
    provider.getEnabledSources.mockReturnValue(['jikan', 'anilist']);
    const service = TestBed.inject(SuggestionSearchService);
    service.search('test').subscribe();
    expect(jikan.search).toHaveBeenCalledWith('test');
    expect(tmdb.search).not.toHaveBeenCalled();
    expect(anilist.search).not.toHaveBeenCalled();
  });

  it('does not search a disabled selected provider', () => {
    provider.isEnabled.mockImplementation((source) => source !== 'jikan');
    const service = TestBed.inject(SuggestionSearchService);
    let result: Suggestion[] | undefined;
    service.search('test', 'jikan').subscribe((value) => (result = value));
    expect(result).toEqual([]);
    expect(tmdb.search).not.toHaveBeenCalled();
    expect(jikan.search).not.toHaveBeenCalled();
    expect(anilist.search).not.toHaveBeenCalled();
  });

  it('returns empty without searching when no providers are enabled', () => {
    provider.getEnabledSources.mockReturnValue([]);
    const service = TestBed.inject(SuggestionSearchService);
    let result: Suggestion[] | undefined;
    service.search('test').subscribe((value) => (result = value));
    expect(result).toEqual([]);
    expect(tmdb.search).not.toHaveBeenCalled();
    expect(jikan.search).not.toHaveBeenCalled();
    expect(anilist.search).not.toHaveBeenCalled();
  });

  it('returns null for invalid getDetails ids', () => {
    const service = TestBed.inject(SuggestionSearchService);
    let r1: unknown, r2: unknown;
    service.getDetails({ source: 'jikan', id: 0 }).subscribe((v) => (r1 = v));
    service.getDetails({ source: 'tmdb', id: 1.5 }).subscribe((v) => (r2 = v));
    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(jikan.getAnimeDetails).not.toHaveBeenCalled();
  });

  describe('search sessions', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('debounces queries and exposes results and loading through the search interface', async () => {
      const service = TestBed.inject(SuggestionSearchService);
      const session = TestBed.runInInjectionContext(() => service.createSession('Unavailable.'));
      const results = [sug({ id: 1, title: 'Breaking Bad' })];
      tmdb.search.mockReturnValue(of(results));

      session.setQuery('  Breaking  ');
      await vi.advanceTimersByTimeAsync(399);
      expect(tmdb.search).not.toHaveBeenCalled();
      expect(session.results()).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      expect(tmdb.search).toHaveBeenCalledWith('Breaking');
      expect(session.results()).toEqual(results);
      expect(session.loading()).toBe(false);
      expect(session.error()).toBe('');
    });

    it('cancels an active request and searches the fallback when the selected provider is disabled', async () => {
      const sources = signal<SuggestionSource[]>(['tmdb', 'jikan']);
      provider.getEnabledSources.mockImplementation(() => sources());
      provider.isEnabled.mockImplementation((source) => sources().includes(source));
      const response = new Subject<Suggestion[]>();
      tmdb.search.mockReturnValue(response);
      const results = [sug({ source: 'jikan', id: 2, title: 'Fallback' })];
      jikan.search.mockReturnValue(of(results));
      const service = TestBed.inject(SuggestionSearchService);
      const session = TestBed.runInInjectionContext(() => service.createSession('Unavailable.'));

      session.setQuery('Breaking');
      await vi.advanceTimersByTimeAsync(400);
      expect(session.loading()).toBe(true);
      sources.set(['jikan']);
      TestBed.tick();
      expect(session.selectedSource()).toBe('jikan');
      expect(session.loading()).toBe(false);
      response.next([sug({ id: 1, title: 'Stale' })]);
      expect(session.results()).toEqual([]);
      await vi.advanceTimersByTimeAsync(400);
      expect(session.results()).toEqual(results);
    });

    it('deduplicates trimmed queries but cancels immediately when switching providers', async () => {
      const response = new Subject<Suggestion[]>();
      tmdb.search.mockReturnValue(response);
      const service = TestBed.inject(SuggestionSearchService);
      const session = TestBed.runInInjectionContext(() => service.createSession('Unavailable.'));
      session.setQuery('Breaking');
      await vi.advanceTimersByTimeAsync(400);
      session.setQuery(' Breaking ');
      await vi.advanceTimersByTimeAsync(400);
      expect(tmdb.search).toHaveBeenCalledTimes(1);
      expect(session.loading()).toBe(true);

      session.setSource('jikan');
      expect(session.loading()).toBe(false);
      response.next([sug({ id: 1, title: 'Stale' })]);
      expect(session.results()).toEqual([]);
      await vi.advanceTimersByTimeAsync(400);
      expect(jikan.search).toHaveBeenCalledWith('Breaking');
    });

    it.each([100, 400])(
      'dismisses pending work after %i ms and allows the same query again',
      async (elapsed) => {
        const response = new Subject<Suggestion[]>();
        tmdb.search.mockReturnValue(response);
        const service = TestBed.inject(SuggestionSearchService);
        const session = TestBed.runInInjectionContext(() => service.createSession('Unavailable.'));
        session.setQuery('Breaking');
        await vi.advanceTimersByTimeAsync(elapsed);
        const callsBeforeSelection = tmdb.search.mock.calls.length;
        session.dismiss('Breaking');
        response.next([sug({ id: 1, title: 'Stale' })]);
        await vi.advanceTimersByTimeAsync(400);
        expect(tmdb.search).toHaveBeenCalledTimes(callsBeforeSelection);
        expect(session.results()).toEqual([]);
        expect(session.loading()).toBe(false);
        expect(session.error()).toBe('');
        expect(session.query()).toBe('Breaking');

        session.setQuery('Breaking');
        await vi.advanceTimersByTimeAsync(400);
        expect(tmdb.search).toHaveBeenCalledTimes(callsBeforeSelection + 1);
      },
    );

    it('clears results immediately on query changes and cancels when the query is too short', async () => {
      const response = new Subject<Suggestion[]>();
      tmdb.search.mockReturnValue(response);
      const service = TestBed.inject(SuggestionSearchService);
      const session = TestBed.runInInjectionContext(() => service.createSession('Unavailable.'));
      session.setQuery('Breaking');
      await vi.advanceTimersByTimeAsync(400);
      response.next([sug({ id: 1, title: 'Breaking Bad' })]);
      session.setQuery('Different');
      expect(session.results()).toEqual([]);
      session.setQuery(' a ');
      response.next([sug({ id: 2, title: 'Late' })]);
      await vi.advanceTimersByTimeAsync(400);
      expect(tmdb.search).toHaveBeenCalledTimes(1);
      expect(session.results()).toEqual([]);
      expect(session.loading()).toBe(false);
    });

    it('distinguishes failures from empty results and recovers on the next query', async () => {
      tmdb.search
        .mockReturnValueOnce(throwError(() => new Error('offline')))
        .mockReturnValue(of([]));
      const service = TestBed.inject(SuggestionSearchService);
      const session = TestBed.runInInjectionContext(() => service.createSession('Unavailable.'));
      session.setQuery('Breaking');
      await vi.advanceTimersByTimeAsync(400);
      expect(session.error()).toBe('Unavailable.');
      expect(session.loading()).toBe(false);
      expect(session.results()).toEqual([]);

      session.setQuery('Different');
      expect(session.error()).toBe('');
      await vi.advanceTimersByTimeAsync(400);
      expect(tmdb.search).toHaveBeenCalledTimes(2);
      expect(session.error()).toBe('');
      expect(session.results()).toEqual([]);
    });

    it('keeps simultaneous title and poster sessions independent', async () => {
      const response = new Subject<Suggestion[]>();
      tmdb.search.mockReturnValue(response);
      const service = TestBed.inject(SuggestionSearchService);
      const title = TestBed.runInInjectionContext(() =>
        service.createSession('Title unavailable.'),
      );
      const poster = TestBed.runInInjectionContext(() =>
        service.createSession('Poster unavailable.'),
      );
      title.setQuery('Breaking');
      poster.setQuery('Different');
      await vi.advanceTimersByTimeAsync(400);
      title.dismiss('Breaking Bad');
      const results = [sug({ id: 1, title: 'Poster result' })];
      response.next(results);
      response.complete();
      expect(title.results()).toEqual([]);
      expect(title.query()).toBe('Breaking Bad');
      expect(poster.results()).toEqual(results);
      expect(poster.selectedSource()).toBe('tmdb');
    });

    it.each([100, 400])('cancels pending work on destruction after %i ms', async (elapsed) => {
      const response = new Subject<Suggestion[]>();
      tmdb.search.mockReturnValue(response);
      const service = TestBed.inject(SuggestionSearchService);
      const owner = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
      const session = runInInjectionContext(owner, () => service.createSession('Unavailable.'));
      session.setQuery('Breaking');
      await vi.advanceTimersByTimeAsync(elapsed);
      const callsBeforeDestroy = tmdb.search.mock.calls.length;
      owner.destroy();
      response.next([sug({ id: 1, title: 'Late' })]);
      await vi.advanceTimersByTimeAsync(400);
      expect(tmdb.search).toHaveBeenCalledTimes(callsBeforeDestroy);
      expect(session.results()).toEqual([]);
      expect(session.loading()).toBe(false);
    });

    it('does not schedule work with no enabled providers', async () => {
      provider.getEnabledSources.mockReturnValue([]);
      const service = TestBed.inject(SuggestionSearchService);
      const session = TestBed.runInInjectionContext(() => service.createSession('Unavailable.'));
      session.setQuery('Breaking');
      await vi.advanceTimersByTimeAsync(400);
      expect(session.selectedSource()).toBeUndefined();
      expect(tmdb.search).not.toHaveBeenCalled();
      expect(jikan.search).not.toHaveBeenCalled();
      expect(anilist.search).not.toHaveBeenCalled();
      expect(session.loading()).toBe(false);
      expect(session.error()).toBe('');
    });
  });

  it('routes getDetails to correct source', () => {
    const service = TestBed.inject(SuggestionSearchService);
    const details = { seasons: [] };
    jikan.getAnimeDetails.mockReturnValue(of(details));
    anilist.getAnimeDetails.mockReturnValue(of(details));
    tmdb.getSeriesDetails.mockReturnValue(of(details));

    let jr: unknown, ar: unknown, tr: unknown;
    service.getDetails({ source: 'jikan', id: 5 }).subscribe((v) => (jr = v));
    service.getDetails({ source: 'anilist', id: 6 }).subscribe((v) => (ar = v));
    service.getDetails({ source: 'tmdb', id: 7 }).subscribe((v) => (tr = v));

    expect(jikan.getAnimeDetails).toHaveBeenCalledWith(5);
    expect(anilist.getAnimeDetails).toHaveBeenCalledWith(6);
    expect(tmdb.getSeriesDetails).toHaveBeenCalledWith(7);
    expect(jr).toEqual(details);
    expect(ar).toEqual(details);
    expect(tr).toEqual(details);
  });

  it('returns null for unknown source', () => {
    const service = TestBed.inject(SuggestionSearchService);
    let r: unknown;
    // @ts-expect-error testing unknown source
    service.getDetails({ source: 'unknown', id: 1 }).subscribe((v) => (r = v));
    expect(r).toBeNull();
  });

  it('catches errors in getDetails and returns null', () => {
    const service = TestBed.inject(SuggestionSearchService);
    jikan.getAnimeDetails.mockReturnValue(throwError(() => new Error('fail')));
    let r: unknown;
    service.getDetails({ source: 'jikan', id: 1 }).subscribe((v) => (r = v));
    expect(r).toBeNull();
  });
});
