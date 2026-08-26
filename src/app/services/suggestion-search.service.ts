import { Injectable, inject } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { Suggestion } from '../models/suggestion.model';
import { AnilistSuggestionService } from './anilist-suggestion.service';
import { JikanSuggestionService } from './jikan-suggestion.service';
import { TmdbSuggestionService } from './tmdb-suggestion.service';

@Injectable({
  providedIn: 'root',
})
export class SuggestionSearchService {
  private readonly tmdb = inject(TmdbSuggestionService);
  private readonly jikan = inject(JikanSuggestionService);
  private readonly anilist = inject(AnilistSuggestionService);

  search(query: string): Observable<Suggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return of([]);
    }

    return forkJoin({
      tmdb: this.tmdb.search(trimmed).pipe(catchError(() => of([] as Suggestion[]))),
      mal: this.jikan.search(trimmed).pipe(catchError(() => of([] as Suggestion[]))),
      anilist: this.anilist.search(trimmed).pipe(catchError(() => of([] as Suggestion[]))),
    }).pipe(
      map(({ tmdb, mal, anilist }) => {
        const merged: Suggestion[] = [...tmdb, ...mal, ...anilist];
        return merged.slice(0, 15);
      }),
    );
  }
}
