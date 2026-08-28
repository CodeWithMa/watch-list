import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SuggestionSearchService } from './suggestion-search.service';
import { AnilistSuggestionService } from './anilist-suggestion.service';
import { JikanSuggestionService } from './jikan-suggestion.service';
import { ProviderSettingsService } from './provider-settings.service';
import { TmdbSuggestionService } from './tmdb-suggestion.service';
import { Suggestion } from '../models/suggestion.model';

function sug(overrides: Partial<Suggestion> & Pick<Suggestion, 'id' | 'title'>): Suggestion {
  return {
    source: 'tmdb',
    type: 'series',
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
      getEnabledSources: vi.fn(() => ['tmdb', 'jikan', 'anilist'] as never[]),
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

  it('merges results from all sources and slices to limit', () => {
    const service = TestBed.inject(SuggestionSearchService);
    const many = Array.from({ length: 10 }, (_, i) => sug({ id: i, title: `t${i}` }));
    tmdb.search.mockReturnValue(of(many.slice(0, 6)));
    jikan.search.mockReturnValue(of(many.slice(6, 12).slice(0, 6)));
    anilist.search.mockReturnValue(of(many.slice(0, 6)));

    // Total 18 but limit is 15
    tmdb.search.mockReturnValue(
      of(Array.from({ length: 6 }, (_, i) => sug({ id: i, title: `a${i}` }))),
    );
    jikan.search.mockReturnValue(
      of(Array.from({ length: 6 }, (_, i) => sug({ id: 100 + i, title: `b${i}` }))),
    );
    anilist.search.mockReturnValue(
      of(Array.from({ length: 6 }, (_, i) => sug({ id: 200 + i, title: `c${i}` }))),
    );

    let result: Suggestion[] = [];
    service.search('  test  ').subscribe((r) => (result = r));
    expect(tmdb.search).toHaveBeenCalledWith('test');
    expect(jikan.search).toHaveBeenCalledWith('test');
    expect(anilist.search).toHaveBeenCalledWith('test');
    expect(result).toHaveLength(15);
    expect(result[0].id).toBe(0);
    expect(result[14].id).toBe(202);
  });

  it('handles source errors by returning empty for that source', () => {
    const service = TestBed.inject(SuggestionSearchService);
    tmdb.search.mockReturnValue(throwError(() => new Error('fail')));
    jikan.search.mockReturnValue(of([sug({ id: 2, title: 'jikan' })]));
    anilist.search.mockReturnValue(throwError(() => new Error('fail')));

    let result: Suggestion[] = [];
    service.search('test').subscribe((r) => (result = r));
    expect(result).toEqual([sug({ id: 2, title: 'jikan' })]);
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
