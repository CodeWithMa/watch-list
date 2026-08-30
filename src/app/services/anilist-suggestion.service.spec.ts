import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AnilistSuggestionService } from './anilist-suggestion.service';

describe('AnilistSuggestionService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('searches AniList and maps TV, TV_SHORT, movie, OVA, and ONA results', () => {
    const service = TestBed.inject(AnilistSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let suggestions: unknown;

    service.search('cowboy bebop').subscribe((results) => {
      suggestions = results;
    });

    const request = http.expectOne((req) => req.url === 'https://graphql.anilist.co');
    expect(request.request.method).toBe('POST');
    const body = request.request.body as { query: string; variables: { search: string } };
    expect(body.variables.search).toBe('cowboy bebop');
    expect(body.query).toContain('media(search:');
    expect(body.query).toContain('isAdult: false');

    request.flush({
      data: {
        Page: {
          media: [
            {
              id: 1,
              title: {
                romaji: 'Cowboy Bebop',
                english: 'Cowboy Bebop',
                native: 'カウボーイビバップ',
              },
              format: 'TV',
              episodes: 26,
              startDate: { year: 1998, month: 4, day: 3 },
              coverImage: {
                extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg',
              },
              description: 'Crime is timeless.<br>Space western.',
            },
            {
              id: 5,
              title: { romaji: 'Cowboy Bebop: The Movie', english: null, native: null },
              format: 'MOVIE',
              episodes: 1,
              startDate: { year: 2001, month: 9, day: 1 },
            },
            {
              id: 6,
              title: { romaji: 'OVA Title', english: null },
              format: 'OVA',
              episodes: 4,
              startDate: { year: 2020, month: 1, day: 1 },
              coverImage: {
                large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx6.jpg',
              },
            },
            {
              id: 7,
              title: { english: 'ONA Title', romaji: '', native: '' },
              format: 'ONA',
              episodes: 12,
              startDate: { year: 2021, month: 6, day: 1 },
            },
            {
              id: 10,
              title: { romaji: 'TV Short Title' },
              format: 'TV_SHORT',
              episodes: 12,
              startDate: { year: 2022, month: 3, day: 5 },
            },
            {
              id: 8,
              title: { romaji: 'Special Title' },
              format: 'SPECIAL',
              episodes: 1,
            },
            {
              id: 9,
              title: { romaji: 'Music Title' },
              format: 'MUSIC',
              episodes: 1,
            },
          ],
        },
      },
    });

    expect(suggestions).toEqual([
      {
        id: 1,
        source: 'anilist',
        title: 'Cowboy Bebop',
        type: 'series',
        year: '1998',
        overview: 'Crime is timeless. Space western.',
        posterUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg',
        isAdult: false,
      },
      {
        id: 5,
        source: 'anilist',
        title: 'Cowboy Bebop: The Movie',
        type: 'movie',
        year: '2001',
        overview: undefined,
        posterUrl: undefined,
        isAdult: false,
      },
      {
        id: 6,
        source: 'anilist',
        title: 'OVA Title',
        type: 'ova',
        year: '2020',
        overview: undefined,
        posterUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx6.jpg',
        isAdult: false,
      },
      {
        id: 7,
        source: 'anilist',
        title: 'ONA Title',
        type: 'ona',
        year: '2021',
        overview: undefined,
        posterUrl: undefined,
        isAdult: false,
      },
      {
        id: 10,
        source: 'anilist',
        title: 'TV Short Title',
        type: 'series',
        year: '2022',
        overview: undefined,
        posterUrl: undefined,
        isAdult: false,
      },
    ]);
  });

  it('prefers romaji title then english then native', () => {
    const service = TestBed.inject(AnilistSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let suggestions: unknown;

    service.search('test').subscribe((results) => {
      suggestions = results;
    });

    http
      .expectOne((req) => req.url === 'https://graphql.anilist.co')
      .flush({
        data: {
          Page: {
            media: [
              {
                id: 100,
                title: { romaji: '', english: 'English Title', native: 'Native Title' },
                format: 'TV',
                episodes: 12,
                startDate: { year: 2023, month: 1, day: 1 },
              },
              {
                id: 101,
                title: { romaji: '', english: '', native: 'Native Only' },
                format: 'TV',
                episodes: 12,
                startDate: { year: 2023, month: 1, day: 1 },
              },
              {
                id: 102,
                title: { romaji: '', english: '', native: '' },
                format: 'TV',
                episodes: 12,
                startDate: { year: 2023, month: 1, day: 1 },
              },
            ],
          },
        },
      });

    expect(suggestions).toEqual([
      {
        id: 100,
        source: 'anilist',
        title: 'English Title',
        type: 'series',
        year: '2023',
        overview: undefined,
        posterUrl: undefined,
        isAdult: false,
      },
      {
        id: 101,
        source: 'anilist',
        title: 'Native Only',
        type: 'series',
        year: '2023',
        overview: undefined,
        posterUrl: undefined,
        isAdult: false,
      },
    ]);
  });

  it('fetches anime details and maps to a single season entry', () => {
    const service = TestBed.inject(AnilistSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let details: unknown;

    service.getAnimeDetails(1).subscribe((result) => {
      details = result;
    });

    const request = http.expectOne((req) => req.url === 'https://graphql.anilist.co');
    expect(request.request.method).toBe('POST');
    const body = request.request.body as { variables: { id: number } };
    expect(body.variables.id).toBe(1);

    request.flush({
      data: {
        Media: {
          id: 1,
          format: 'TV',
          episodes: 26,
          startDate: { year: 1998, month: 4, day: 3 },
        },
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
    const service = TestBed.inject(AnilistSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let details: unknown;

    service.getAnimeDetails(999).subscribe((result) => {
      details = result;
    });

    http
      .expectOne((req) => req.url === 'https://graphql.anilist.co')
      .flush({
        data: {
          Media: {
            id: 999,
            format: 'TV',
            episodes: null,
            startDate: { year: null, month: null, day: null },
          },
        },
      });

    expect(details).toEqual({ seasons: [] });
  });

  it('returns no suggestions for short queries and invalid ids', () => {
    const service = TestBed.inject(AnilistSuggestionService);
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
    http.expectNone('https://graphql.anilist.co');
    http.verify();
  });

  it('propagates HTTP errors to callers', () => {
    const service = TestBed.inject(AnilistSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let errorStatus: number | undefined;

    service.search('cowboy').subscribe({
      error: (error: { status?: number }) => {
        errorStatus = error.status;
      },
    });

    http
      .expectOne((req) => req.url === 'https://graphql.anilist.co')
      .flush(
        { errors: [{ message: 'Too Many Requests.', status: 429 }] },
        { status: 429, statusText: 'Too Many Requests' },
      );

    expect(errorStatus).toBe(429);
  });

  it('strips HTML tags and decodes entities in overview', () => {
    const service = TestBed.inject(AnilistSuggestionService);
    const http = TestBed.inject(HttpTestingController);
    let suggestions: unknown;

    service.search('test').subscribe((results) => {
      suggestions = results;
    });

    http
      .expectOne((req) => req.url === 'https://graphql.anilist.co')
      .flush({
        data: {
          Page: {
            media: [
              {
                id: 200,
                title: { romaji: 'Html Anime' },
                format: 'TV',
                episodes: 12,
                startDate: { year: 2024, month: 7, day: 1 },
                description: '<i>Great</i> anime &amp; more<br>Next line.',
              },
            ],
          },
        },
      });

    expect(suggestions).toEqual([
      {
        id: 200,
        source: 'anilist',
        title: 'Html Anime',
        type: 'series',
        year: '2024',
        overview: 'Great anime & more Next line.',
        posterUrl: undefined,
        isAdult: false,
      },
    ]);
  });
});
