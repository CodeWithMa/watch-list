import { Injectable, inject } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { SeriesDetails, Suggestion, SuggestionSource } from '../models/suggestion.model';
import { AnilistSuggestionService } from './anilist-suggestion.service';
import { JikanSuggestionService } from './jikan-suggestion.service';
import { TmdbSuggestionService } from './tmdb-suggestion.service';
import {
  SUGGESTION_MERGED_LIMIT,
  SUGGESTION_MIN_QUERY_LENGTH,
} from '../domain/suggestion.constants';

@Injectable({
  providedIn: 'root',
})
export class SuggestionSearchService {
  private readonly tmdb = inject(TmdbSuggestionService);
  private readonly jikan = inject(JikanSuggestionService);
  private readonly anilist = inject(AnilistSuggestionService);

  search(query: string): Observable<Suggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < SUGGESTION_MIN_QUERY_LENGTH) {
      return of([]);
    }

    return forkJoin({
      tmdb: this.tmdb.search(trimmed).pipe(catchError(() => of([] as Suggestion[]))),
      jikan: this.jikan.search(trimmed).pipe(catchError(() => of([] as Suggestion[]))),
      anilist: this.anilist.search(trimmed).pipe(catchError(() => of([] as Suggestion[]))),
    }).pipe(
      map(({ tmdb, jikan, anilist }) => {
        const merged = [...tmdb, ...jikan, ...anilist];
        return merged.slice(0, SUGGESTION_MERGED_LIMIT);
      }),
    );
  }

  getDetails(ref: Pick<Suggestion, 'source' | 'id'>): Observable<SeriesDetails | null> {
    if (!Number.isInteger(ref.id) || ref.id < 1) {
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
