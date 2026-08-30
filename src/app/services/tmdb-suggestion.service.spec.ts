import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TmdbSettingsService } from './tmdb-settings.service';
import { TmdbSuggestionService } from './tmdb-suggestion.service';

describe('TmdbSuggestionService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: TmdbSettingsService,
          useValue: {
            getCredential: () => ({ type: 'read-token', value: 'read-token' }),
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('sends bearer auth and maps movie and TV results', () => {
    const service = TestBed.inject(TmdbSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let suggestions: unknown;

    service.search('breaking').subscribe((results) => {
      suggestions = results;
    });

    const request = http.expectOne(
      (req) => req.url === 'https://api.themoviedb.org/3/search/multi',
    );
    expect(request.request.headers.get('Authorization')).toBe('Bearer read-token');
    expect(request.request.params.get('api_key')).toBeNull();
    expect(request.request.params.get('query')).toBe('breaking');
    expect(request.request.params.get('include_adult')).toBe('false');

    request.flush({
      results: [
        {
          id: 1,
          media_type: 'movie',
          title: 'Breaking Movie',
          release_date: '2026-01-02',
          overview: 'Movie overview',
          poster_path: '/movie.jpg',
        },
        {
          id: 2,
          media_type: 'tv',
          name: 'Breaking Show',
          first_air_date: '2025-03-04',
        },
        {
          id: 3,
          media_type: 'person',
          name: 'Actor',
        },
      ],
    });

    expect(suggestions).toEqual([
      {
        id: 1,
        source: 'tmdb',
        title: 'Breaking Movie',
        type: 'movie',
        year: '2026',
        overview: 'Movie overview',
        posterUrl: 'https://image.tmdb.org/t/p/w342/movie.jpg',
        isAdult: false,
      },
      {
        id: 2,
        source: 'tmdb',
        title: 'Breaking Show',
        type: 'series',
        year: '2025',
        overview: undefined,
        posterUrl: undefined,
        isAdult: false,
      },
    ]);
  });

  it('uses the API key query param when no read token exists', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: TmdbSettingsService,
          useValue: {
            getCredential: () => ({ type: 'api-key', value: 'api-key-value' }),
          },
        },
      ],
    });

    const service = TestBed.inject(TmdbSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let results: unknown;

    service.search('breaking').subscribe((suggestions) => {
      results = suggestions;
    });

    const request = http.expectOne(
      (req) => req.url === 'https://api.themoviedb.org/3/search/multi',
    );
    expect(request.request.headers.get('Authorization')).toBeNull();
    expect(request.request.params.get('api_key')).toBe('api-key-value');
    request.flush({ results: [] });

    expect(results).toEqual([]);
    http.verify();
  });

  it('fetches TV details and maps season episode counts', () => {
    const service = TestBed.inject(TmdbSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let details: unknown;

    service.getSeriesDetails(1396).subscribe((result) => {
      details = result;
    });

    const request = http.expectOne((req) => req.url === 'https://api.themoviedb.org/3/tv/1396');
    expect(request.request.headers.get('Authorization')).toBe('Bearer read-token');
    expect(request.request.params.get('language')).toBe('en-US');

    request.flush({
      seasons: [
        {
          season_number: 0,
          episode_count: 5,
          air_date: '2009-02-17',
        },
        {
          season_number: 2,
          episode_count: 13,
          air_date: '2009-03-08',
        },
        {
          season_number: 1,
          episode_count: 7,
          air_date: '2008-01-20',
        },
        {
          season_number: 3,
          episode_count: 0,
          air_date: 'not-a-date',
        },
      ],
    });

    expect(details).toEqual({
      seasons: [
        {
          seasonNumber: 1,
          totalEpisodes: 7,
          firstEpisodeAirDate: '2008-01-20',
        },
        {
          seasonNumber: 2,
          totalEpisodes: 13,
          firstEpisodeAirDate: '2009-03-08',
        },
        {
          seasonNumber: 3,
          totalEpisodes: undefined,
          firstEpisodeAirDate: undefined,
        },
      ],
    });
  });

  it('returns no suggestions without credentials or searchable query', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: TmdbSettingsService,
          useValue: {
            getCredential: () => null,
          },
        },
      ],
    });

    const service = TestBed.inject(TmdbSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let results: unknown;

    service.search('breaking').subscribe((suggestions) => {
      results = suggestions;
    });
    service.search('b').subscribe();
    service.getSeriesDetails(1396).subscribe((details) => {
      expect(details).toBeNull();
    });

    expect(results).toEqual([]);
    http.expectNone('https://api.themoviedb.org/3/search/multi');
    http.expectNone('https://api.themoviedb.org/3/tv/1396');
    http.verify();
  });

  it('propagates HTTP errors to callers', () => {
    const service = TestBed.inject(TmdbSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let errorStatus: number | undefined;

    service.search('breaking').subscribe({
      error: (error: { status?: number }) => {
        errorStatus = error.status;
      },
    });

    http
      .expectOne((req) => req.url === 'https://api.themoviedb.org/3/search/multi')
      .flush({ status_message: 'Invalid token' }, { status: 401, statusText: 'Unauthorized' });

    expect(errorStatus).toBe(401);
  });
});
