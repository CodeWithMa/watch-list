import { Injectable, inject } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { Suggestion } from '../models/suggestion.model';
import { JikanSuggestionService } from './jikan-suggestion.service';
import { TmdbSuggestionService } from './tmdb-suggestion.service';

@Injectable({
  providedIn: 'root',
})
export class SuggestionSearchService {
  private readonly tmdb = inject(TmdbSuggestionService);
  private readonly jikan = inject(JikanSuggestionService);

  search(query: string): Observable<Suggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return of([]);
    }

    return forkJoin({
      tmdb: this.tmdb.search(trimmed).pipe(catchError(() => of([] as Suggestion[]))),
      mal: this.jikan.search(trimmed).pipe(catchError(() => of([] as Suggestion[]))),
    }).pipe(
      map(({ tmdb, mal }) => {
        const merged: Suggestion[] = [...tmdb, ...mal];
        return merged.slice(0, 10);
      }),
    );
  }
}
