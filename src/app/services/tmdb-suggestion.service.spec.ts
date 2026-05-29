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
            token: () => 'read-token'
          }
        }
      ]
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

    const request = http.expectOne((req) => req.url === 'https://api.themoviedb.org/3/search/multi');
    expect(request.request.headers.get('Authorization')).toBe('Bearer read-token');
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
          poster_path: '/movie.jpg'
        },
        {
          id: 2,
          media_type: 'tv',
          name: 'Breaking Show',
          first_air_date: '2025-03-04'
        },
        {
          id: 3,
          media_type: 'person',
          name: 'Actor'
        }
      ]
    });

    expect(suggestions).toEqual([
      {
        tmdbId: 1,
        title: 'Breaking Movie',
        type: 'movie',
        year: '2026',
        overview: 'Movie overview',
        posterPath: '/movie.jpg'
      },
      {
        tmdbId: 2,
        title: 'Breaking Show',
        type: 'series',
        year: '2025',
        overview: undefined,
        posterPath: undefined
      }
    ]);
  });

  it('returns no suggestions without a token or searchable query', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: TmdbSettingsService,
          useValue: {
            token: () => ''
          }
        }
      ]
    });

    const service = TestBed.inject(TmdbSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let results: unknown;

    service.search('breaking').subscribe((suggestions) => {
      results = suggestions;
    });
    service.search('b').subscribe();

    expect(results).toEqual([]);
    http.expectNone('https://api.themoviedb.org/3/search/multi');
  });

  it('handles HTTP errors as empty suggestions', () => {
    const service = TestBed.inject(TmdbSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let results: unknown;

    service.search('breaking').subscribe((suggestions) => {
      results = suggestions;
    });

    http.expectOne((req) => req.url === 'https://api.themoviedb.org/3/search/multi').flush(
      { status_message: 'Invalid token' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(results).toEqual([]);
  });
});
