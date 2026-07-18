import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { TmdbSeriesDetails, TmdbSuggestion } from '../models/tmdb-suggestion.model';
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

interface TmdbTvDetailsResponse {
  seasons?: unknown[];
}

interface TmdbTvSeason {
  season_number?: unknown;
  episode_count?: unknown;
  air_date?: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class TmdbSuggestionService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(TmdbSettingsService);

  search(query: string): Observable<TmdbSuggestion[]> {
    const trimmedQuery = query.trim();
    const requestOptions = this.createRequestOptions();

    if (trimmedQuery.length < 2 || !requestOptions) {
      return of([]);
    }

    let params = new HttpParams()
      .set('query', trimmedQuery)
      .set('include_adult', 'false')
      .set('language', 'en-US')
      .set('page', '1');

    if (requestOptions.apiKey) {
      params = params.set('api_key', requestOptions.apiKey);
    }

    return this.http
      .get<TmdbSearchResponse>('https://api.themoviedb.org/3/search/multi', {
        headers: requestOptions.headers,
        params,
      })
      .pipe(map((response) => this.mapResults(response.results ?? [])));
  }

  getSeriesDetails(tmdbId: number): Observable<TmdbSeriesDetails | null> {
    const requestOptions = this.createRequestOptions();

    if (!Number.isInteger(tmdbId) || tmdbId < 1 || !requestOptions) {
      return of(null);
    }

    let params = new HttpParams().set('language', 'en-US');
    if (requestOptions.apiKey) {
      params = params.set('api_key', requestOptions.apiKey);
    }

    return this.http
      .get<TmdbTvDetailsResponse>(`https://api.themoviedb.org/3/tv/${tmdbId}`, {
        headers: requestOptions.headers,
        params,
      })
      .pipe(map((response) => ({ seasons: this.mapSeasons(response.seasons ?? []) })));
  }

  private createRequestOptions(): { headers: HttpHeaders; apiKey?: string } | null {
    const credential = this.settings.getCredential();

    if (!credential) {
      return null;
    }

    if (credential.type === 'read-token') {
      return {
        headers: new HttpHeaders({
          Authorization: `Bearer ${credential.value}`,
          accept: 'application/json',
        }),
      };
    }

    return {
      headers: new HttpHeaders({
        accept: 'application/json',
      }),
      apiKey: credential.value,
    };
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
    date: unknown,
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
      posterPath: typeof result.poster_path === 'string' ? result.poster_path : undefined,
    };
  }

  private mapSeasons(seasons: unknown[]) {
    return seasons
      .map((season) => this.mapSeason(season))
      .filter((season): season is NonNullable<ReturnType<typeof this.mapSeason>> => season !== null)
      .sort((a, b) => a.seasonNumber - b.seasonNumber);
  }

  private mapSeason(season: unknown) {
    if (!season || typeof season !== 'object') {
      return null;
    }

    const candidate = season as TmdbTvSeason;
    if (
      typeof candidate.season_number !== 'number' ||
      candidate.season_number < 1 ||
      !Number.isInteger(candidate.season_number)
    ) {
      return null;
    }

    return {
      seasonNumber: candidate.season_number,
      totalEpisodes:
        typeof candidate.episode_count === 'number' && candidate.episode_count >= 1
          ? candidate.episode_count
          : undefined,
      firstEpisodeAirDate:
        typeof candidate.air_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate.air_date)
          ? candidate.air_date
          : undefined,
    };
  }
}
