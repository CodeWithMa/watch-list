import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { JikanSuggestionService } from './jikan-suggestion.service';

describe('JikanSuggestionService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('searches Jikan and maps TV, movie, OVA, and ONA results', () => {
    const service = TestBed.inject(JikanSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let suggestions: unknown;

    service.search('cowboy bebop').subscribe((results) => {
      suggestions = results;
    });

    const request = http.expectOne((req) => req.url === 'https://api.jikan.moe/v4/anime');
    expect(request.request.params.get('q')).toBe('cowboy bebop');
    expect(request.request.params.get('limit')).toBe('8');
    expect(request.request.params.get('sfw')).toBe('true');

    request.flush({
      data: [
        {
          mal_id: 1,
          title: 'Cowboy Bebop',
          type: 'TV',
          episodes: 26,
          aired: { from: '1998-04-03T00:00:00+00:00' },
          images: {
            jpg: { large_image_url: 'https://cdn.myanimelist.net/images/anime/4/19644l.jpg' },
          },
          synopsis: 'Crime is timeless.',
        },
        {
          mal_id: 5,
          title: 'Cowboy Bebop: The Movie',
          type: 'Movie',
          episodes: 1,
          aired: { from: '2001-09-01T00:00:00+00:00' },
        },
        {
          mal_id: 6,
          title: 'OVA Title',
          type: 'OVA',
          episodes: 4,
          aired: { from: '2020-01-01T00:00:00+00:00' },
          images: { jpg: { image_url: 'https://cdn.myanimelist.net/images/anime/6/ova.jpg' } },
        },
        {
          mal_id: 7,
          title: 'ONA Title',
          type: 'ONA',
          episodes: 12,
          aired: { from: '2021-06-01T00:00:00+00:00' },
        },
        {
          mal_id: 8,
          title: 'Special Title',
          type: 'Special',
          episodes: 1,
        },
        {
          mal_id: 9,
          title: 'Music Title',
          type: 'Music',
          episodes: 1,
        },
      ],
    });

    expect(suggestions).toEqual([
      {
        id: 1,
        source: 'jikan',
        title: 'Cowboy Bebop',
        type: 'series',
        year: '1998',
        overview: 'Crime is timeless.',
        posterUrl: 'https://cdn.myanimelist.net/images/anime/4/19644l.jpg',
        isAdult: false,
      },
      {
        id: 5,
        source: 'jikan',
        title: 'Cowboy Bebop: The Movie',
        type: 'movie',
        year: '2001',
        overview: undefined,
        posterUrl: undefined,
        isAdult: false,
      },
      {
        id: 6,
        source: 'jikan',
        title: 'OVA Title',
        type: 'ova',
        year: '2020',
        overview: undefined,
        posterUrl: 'https://cdn.myanimelist.net/images/anime/6/ova.jpg',
        isAdult: false,
      },
      {
        id: 7,
        source: 'jikan',
        title: 'ONA Title',
        type: 'ona',
        year: '2021',
        overview: undefined,
        posterUrl: undefined,
        isAdult: false,
      },
    ]);
  });

  it('fetches anime details and maps to a single season entry', () => {
    const service = TestBed.inject(JikanSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let details: unknown;

    service.getAnimeDetails(1).subscribe((result) => {
      details = result;
    });

    const request = http.expectOne((req) => req.url === 'https://api.jikan.moe/v4/anime/1');
    request.flush({
      data: {
        mal_id: 1,
        title: 'Cowboy Bebop',
        type: 'TV',
        episodes: 26,
        aired: { from: '1998-04-03T00:00:00+00:00' },
      },
    });

    expect(details).toEqual({
      seasons: [
        {
          seasonNumber: 1,
          totalEpisodes: 26,
          firstEpisodeAirDate: '1998-04-03',
        },
      ],
    });
  });

  it('handles ongoing anime with null episodes and missing air date', () => {
    const service = TestBed.inject(JikanSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let details: unknown;

    service.getAnimeDetails(999).subscribe((result) => {
      details = result;
    });

    http
      .expectOne((req) => req.url === 'https://api.jikan.moe/v4/anime/999')
      .flush({
        data: {
          mal_id: 999,
          title: 'Ongoing Show',
          type: 'TV',
          episodes: null,
          aired: { from: null },
        },
      });

    expect(details).toEqual({ seasons: [] });
  });

  it('returns no suggestions for short queries and invalid ids', () => {
    const service = TestBed.inject(JikanSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let results: unknown;

    service.search('b').subscribe((suggestions) => {
      results = suggestions;
    });
    service.getAnimeDetails(0).subscribe((details) => {
      expect(details).toBeNull();
    });
    service.getAnimeDetails(1.5).subscribe((details) => {
      expect(details).toBeNull();
    });

    expect(results).toEqual([]);
    http.expectNone('https://api.jikan.moe/v4/anime');
    http.expectNone('https://api.jikan.moe/v4/anime/0');
    http.verify();
  });

  it('propagates HTTP errors to callers', () => {
    const service = TestBed.inject(JikanSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let errorStatus: number | undefined;

    service.search('cowboy').subscribe({
      error: (error: { status?: number }) => {
        errorStatus = error.status;
      },
    });

    http
      .expectOne((req) => req.url === 'https://api.jikan.moe/v4/anime')
      .flush({ message: 'error' }, { status: 429, statusText: 'Too Many Requests' });

    expect(errorStatus).toBe(429);
  });
});
