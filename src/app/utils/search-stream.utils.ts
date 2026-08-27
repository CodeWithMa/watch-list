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
import { Suggestion } from '../models/suggestion.model';
import {
  SUGGESTION_DEBOUNCE_MS,
  SUGGESTION_MIN_QUERY_LENGTH,
} from '../domain/suggestion.constants';

export interface SearchStreamOptions {
  debounceMs?: number;
  minLength?: number;
  distinct?: boolean;
  shouldSkip?: (query: string) => boolean;
  onLoadingChange?: (loading: boolean) => void;
  onError?: (message: string) => void;
}

export interface SearchStream {
  query: Subject<string>;
  results: Observable<Suggestion[]>;
}

export function createSearchStream(
  searchFn: (query: string) => Observable<Suggestion[]>,
  errorMessage: string,
  options: SearchStreamOptions = {},
): SearchStream {
  const debounceMs = options.debounceMs ?? SUGGESTION_DEBOUNCE_MS;
  const minLength = options.minLength ?? SUGGESTION_MIN_QUERY_LENGTH;
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
