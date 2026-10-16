import { DestroyRef, Signal, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { Observable, Subscription, defer, switchMap, timer } from 'rxjs';
import { Suggestion, SuggestionSource } from '../models/suggestion.model';
import {
  SUGGESTION_DEBOUNCE_MS,
  SUGGESTION_MIN_QUERY_LENGTH,
} from '../domain/suggestion.constants';

export function createSearchStream(
  search: (query: string, source: SuggestionSource) => Observable<Suggestion[]>,
  enabledSources: Signal<SuggestionSource[]>,
  errorMessage: string,
) {
  const destroyRef = inject(DestroyRef);
  const selectedSource = linkedSignal<SuggestionSource[], SuggestionSource | undefined>({
    source: enabledSources,
    computation: (sources, previous) =>
      previous?.value && sources.includes(previous.value) ? previous.value : sources[0],
  });
  const query = signal('');
  const results = signal<Suggestion[]>([]);
  const loading = signal(false);
  const error = signal('');
  let pending: Subscription | undefined;
  let lastRequest: { query: string; source: SuggestionSource | undefined } | undefined;

  function clear() {
    pending?.unsubscribe();
    pending = undefined;
    results.set([]);
    loading.set(false);
    error.set('');
  }

  function request() {
    const trimmed = query().trim();
    const source = selectedSource();
    if (lastRequest?.query === trimmed && lastRequest.source === source && !error()) return;
    clear();
    lastRequest = { query: trimmed, source };
    if (trimmed.length < SUGGESTION_MIN_QUERY_LENGTH || !source || destroyRef.destroyed) return;

    pending = timer(SUGGESTION_DEBOUNCE_MS)
      .pipe(
        switchMap(() => {
          loading.set(true);
          return defer(() => search(trimmed, source));
        }),
      )
      .subscribe({
        next: (suggestions) => results.set(suggestions),
        error: () => {
          loading.set(false);
          error.set(errorMessage);
        },
        complete: () => loading.set(false),
      });
  }

  // Settings can remove the selected provider without a menu interaction.
  effect(() => {
    const source = selectedSource();
    if (lastRequest && lastRequest.source !== source) untracked(request);
  });
  destroyRef.onDestroy(clear);

  return {
    enabledSources,
    selectedSource: selectedSource.asReadonly(),
    query: query.asReadonly(),
    results: results.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    setQuery(value: string) {
      query.set(value);
      request();
    },
    setSource(source: SuggestionSource) {
      if (!enabledSources().includes(source)) return;
      selectedSource.set(source);
      request();
    },
    // Selection updates the displayed query without scheduling another search.
    dismiss(value = '') {
      query.set(value);
      lastRequest = undefined;
      clear();
    },
  };
}
