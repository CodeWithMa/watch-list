import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { TmdbSuggestion } from '../models/tmdb-suggestion.model';
import { TmdbSettingsService } from './tmdb-settings.service';

interface TmdbSearchResponse {
  results?: unknown[];
}

interface TmdbSearchResult {
  id?: unknown;
  media_type?: unknown;
  title?: unknown;
  name?: unknown;
  release_date?: unknown;
  first_air_date?: unknown;
  overview?: unknown;
  poster_path?: unknown;
  popularity?: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class TmdbSuggestionService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(TmdbSettingsService);

  search(query: string): Observable<TmdbSuggestion[]> {
    const trimmedQuery = query.trim();
    const token = this.settings.token();

    if (trimmedQuery.length < 2 || !token) {
      return of([]);
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      accept: 'application/json'
    });
    const params = new HttpParams()
      .set('query', trimmedQuery)
      .set('include_adult', 'false')
      .set('language', 'en-US')
      .set('page', '1');

    return this.http
      .get<TmdbSearchResponse>('https://api.themoviedb.org/3/search/multi', { headers, params })
      .pipe(
        map((response) => this.mapResults(response.results ?? [])),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse) {
            console.warn('TMDB suggestion search failed:', error.message);
          }
          return of([]);
        })
      );
  }

  private mapResults(results: unknown[]): TmdbSuggestion[] {
    return results
      .map((result) => this.mapResult(result))
      .filter((suggestion): suggestion is TmdbSuggestion => suggestion !== null)
      .slice(0, 8);
  }

  private mapResult(result: unknown): TmdbSuggestion | null {
    if (!result || typeof result !== 'object') {
      return null;
    }

    const candidate = result as TmdbSearchResult;
    if (typeof candidate.id !== 'number') {
      return null;
    }

    if (candidate.media_type === 'movie') {
      return this.createSuggestion(candidate, 'movie', candidate.title, candidate.release_date);
    }

    if (candidate.media_type === 'tv') {
      return this.createSuggestion(candidate, 'series', candidate.name, candidate.first_air_date);
    }

    return null;
  }

  private createSuggestion(
    result: TmdbSearchResult,
    type: TmdbSuggestion['type'],
    title: unknown,
    date: unknown
  ): TmdbSuggestion | null {
    if (typeof title !== 'string' || !title.trim()) {
      return null;
    }

    return {
      tmdbId: result.id as number,
      title: title.trim(),
      type,
      year: typeof date === 'string' && date.length >= 4 ? date.slice(0, 4) : undefined,
      overview: typeof result.overview === 'string' ? result.overview : undefined,
      posterPath: typeof result.poster_path === 'string' ? result.poster_path : undefined
    };
  }
}
