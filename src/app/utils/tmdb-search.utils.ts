import {
  Observable,
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  of,
  finalize,
} from 'rxjs';
import { TmdbSuggestion } from '../models/tmdb-suggestion.model';

export interface TmdbSearchOptions {
  debounceMs?: number;
  minLength?: number;
  distinct?: boolean;
  shouldSkip?: (query: string) => boolean;
  onLoadingChange?: (loading: boolean) => void;
  onError?: (message: string) => void;
}

export interface TmdbSearch {
  query: Subject<string>;
  results: Observable<TmdbSuggestion[]>;
}

export function createTmdbSearchStream(
  searchFn: (query: string) => Observable<TmdbSuggestion[]>,
  errorMessage: string,
  options: TmdbSearchOptions = {},
): TmdbSearch {
  const debounceMs = options.debounceMs ?? 300;
  const minLength = options.minLength ?? 2;
  const query = new Subject<string>();

  let stream = query.pipe(debounceTime(debounceMs));
  if (options.distinct) {
    stream = stream.pipe(
      distinctUntilChanged((previous, current) => previous.trim() === current.trim()),
    );
  }

  const results = stream.pipe(
    switchMap((raw) => {
      const trimmed = raw.trim();
      options.onError?.('');

      if (options.shouldSkip?.(trimmed)) {
        options.onLoadingChange?.(false);
        return of([]);
      }

      if (trimmed.length < minLength) {
        options.onLoadingChange?.(false);
        return of([]);
      }

      options.onLoadingChange?.(true);
      return searchFn(trimmed).pipe(
        catchError(() => {
          options.onError?.(errorMessage);
          return of([]);
        }),
        finalize(() => {
          options.onLoadingChange?.(false);
        }),
      );
    }),
  );

  return { query, results };
}
