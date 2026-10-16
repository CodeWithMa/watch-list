import { Observable, of } from 'rxjs';
import { vi } from 'vitest';
import { SeriesDetails, Suggestion, SuggestionSource } from '../models/suggestion.model';
import { AnilistSuggestionService } from './anilist-suggestion.service';
import { JikanSuggestionService } from './jikan-suggestion.service';
import { TmdbSuggestionService } from './tmdb-suggestion.service';

// Control external provider responses while exercising the real search lifecycle.
export function createSuggestionProviders() {
  const search = vi.fn<(query: string, source: SuggestionSource) => Observable<Suggestion[]>>(() =>
    of([]),
  );
  const getDetails = vi.fn<
    (ref: Pick<Suggestion, 'source' | 'id'>) => Observable<SeriesDetails | null>
  >(() => of(null));

  return {
    search,
    getDetails,
    providers: [
      {
        provide: TmdbSuggestionService,
        useValue: {
          search: (query: string) => search(query, 'tmdb'),
          getSeriesDetails: (id: number) => getDetails({ source: 'tmdb', id }),
        },
      },
      {
        provide: JikanSuggestionService,
        useValue: {
          search: (query: string) => search(query, 'jikan'),
          getAnimeDetails: (id: number) => getDetails({ source: 'jikan', id }),
        },
      },
      {
        provide: AnilistSuggestionService,
        useValue: {
          search: (query: string) => search(query, 'anilist'),
          getAnimeDetails: (id: number) => getDetails({ source: 'anilist', id }),
        },
      },
    ],
  };
}
