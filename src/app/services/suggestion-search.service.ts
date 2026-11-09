import { Injectable, computed, inject } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { SeriesDetails, Suggestion, SuggestionSource } from '../models/suggestion.model';
import { AnilistSuggestionService } from './anilist-suggestion.service';
import { JikanSuggestionService } from './jikan-suggestion.service';
import { ProviderSettingsService } from './provider-settings.service';
import { TmdbSettingsService } from './tmdb-settings.service';
import { TmdbSuggestionService } from './tmdb-suggestion.service';
import { SUGGESTION_MIN_QUERY_LENGTH } from '../domain/suggestion.constants';
import { createSearchStream } from '../utils/search-stream.utils';

@Injectable({
  providedIn: 'root',
})
export class SuggestionSearchService {
  private readonly tmdb = inject(TmdbSuggestionService);
  private readonly jikan = inject(JikanSuggestionService);
  private readonly anilist = inject(AnilistSuggestionService);
  private readonly providers = inject(ProviderSettingsService);
  private readonly tmdbSettings = inject(TmdbSettingsService);

  /** Sources that cannot return results until the user finishes connecting them. */
  readonly sourcesNeedingSetup = computed<SuggestionSource[]>(() =>
    this.tmdbSettings.getCredential() ? [] : ['tmdb'],
  );

  createSession(errorMessage: string) {
    const stream = createSearchStream(
      (query, source) => this.search(query, source),
      computed(() => this.providers.getEnabledSources()),
      errorMessage,
    );
    return {
      ...stream,
      sourcesNeedingSetup: this.sourcesNeedingSetup,
      needsSetup: computed(() => {
        const source = stream.selectedSource();
        return !!source && this.sourcesNeedingSetup().includes(source);
      }),
    };
  }

  search(query: string, source = this.providers.getEnabledSources()[0]): Observable<Suggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < SUGGESTION_MIN_QUERY_LENGTH) {
      return of([]);
    }

    if (!source || !this.providers.isEnabled(source)) {
      return of([]);
    }

    const provider = { tmdb: this.tmdb, jikan: this.jikan, anilist: this.anilist }[source];
    return provider.search(trimmed);
  }

  getDetails(ref: Pick<Suggestion, 'source' | 'id'>): Observable<SeriesDetails | null> {
    if (!Number.isInteger(ref.id) || ref.id < 1) {
      return of(null);
    }

    if (!this.providers.isEnabled(ref.source as SuggestionSource)) {
      return of(null);
    }

    let details$: Observable<SeriesDetails | null>;
    switch (ref.source as SuggestionSource) {
      case 'jikan':
        details$ = this.jikan.getAnimeDetails(ref.id);
        break;
      case 'anilist':
        details$ = this.anilist.getAnimeDetails(ref.id);
        break;
      case 'tmdb':
        details$ = this.tmdb.getSeriesDetails(ref.id);
        break;
      default:
        return of(null);
    }

    return details$.pipe(catchError(() => of(null)));
  }
}
