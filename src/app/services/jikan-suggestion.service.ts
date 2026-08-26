import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { SeriesDetails, Suggestion } from '../models/suggestion.model';
import { ItemType } from '../models/item.model';

interface JikanSearchResponse {
  data?: unknown[];
}

interface JikanAnime {
  mal_id?: unknown;
  title?: unknown;
  title_english?: unknown;
  type?: unknown;
  episodes?: unknown;
  aired?: unknown;
  images?: unknown;
  synopsis?: unknown;
}

interface JikanAired {
  from?: unknown;
}

interface JikanImages {
  jpg?: unknown;
}

interface JikanJpg {
  large_image_url?: unknown;
  image_url?: unknown;
}

interface JikanDetailsResponse {
  data?: unknown;
}

const JIKAN_TYPE_MAP: Record<string, ItemType> = {
  TV: 'series',
  Movie: 'movie',
  OVA: 'ova',
  ONA: 'ona',
};

@Injectable({
  providedIn: 'root',
})
export class JikanSuggestionService {
  private readonly http = inject(HttpClient);

  search(query: string): Observable<Suggestion[]> {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      return of([]);
    }

    const params = new HttpParams()
      .set('q', trimmedQuery)
      .set('limit', '8')
      .set('sfw', 'true')
      .set('order_by', 'popularity')
      .set('sort', 'asc');

    return this.http
      .get<JikanSearchResponse>('https://api.jikan.moe/v4/anime', { params })
      .pipe(map((response) => this.mapResults(response.data ?? [])));
  }

  getAnimeDetails(malId: number): Observable<SeriesDetails | null> {
    if (!Number.isInteger(malId) || malId < 1) {
      return of(null);
    }

    return this.http
      .get<JikanDetailsResponse>(`https://api.jikan.moe/v4/anime/${malId}`)
      .pipe(map((response) => this.mapDetails(response.data)));
  }

  private mapResults(results: unknown[]): Suggestion[] {
    return results
      .map((result) => this.mapResult(result))
      .filter((s): s is Suggestion => s !== null)
      .slice(0, 8);
  }

  private mapResult(result: unknown): Suggestion | null {
    if (!result || typeof result !== 'object') {
      return null;
    }

    const candidate = result as JikanAnime;
    if (typeof candidate.mal_id !== 'number') {
      return null;
    }

    const type = this.mapType(candidate.type);
    if (!type) {
      return null;
    }

    const title = this.resolveTitle(candidate);
    if (!title) {
      return null;
    }

    return {
      id: candidate.mal_id,
      source: 'mal',
      title,
      type,
      year: this.extractYear(candidate.aired),
      overview: typeof candidate.synopsis === 'string' ? candidate.synopsis : undefined,
      posterUrl: this.extractImageUrl(candidate.images),
    };
  }

  private mapDetails(data: unknown): SeriesDetails | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const candidate = data as JikanAnime;
    const season = this.buildSeason(candidate);
    return { seasons: season ? [season] : [] };
  }

  private buildSeason(candidate: JikanAnime) {
    const totalEpisodes =
      typeof candidate.episodes === 'number' && candidate.episodes >= 1
        ? candidate.episodes
        : undefined;

    const firstEpisodeAirDate = this.extractDate(candidate.aired);

    // Only return a season entry if we have at least episode count or air date
    if (totalEpisodes === undefined && !firstEpisodeAirDate) {
      return null;
    }

    return {
      seasonNumber: 1,
      totalEpisodes,
      firstEpisodeAirDate,
    };
  }

  private mapType(rawType: unknown): ItemType | null {
    if (typeof rawType !== 'string') {
      return null;
    }
    return JIKAN_TYPE_MAP[rawType] ?? null;
  }

  private resolveTitle(candidate: JikanAnime): string | null {
    if (typeof candidate.title === 'string' && candidate.title.trim()) {
      return candidate.title.trim();
    }
    if (typeof candidate.title_english === 'string' && candidate.title_english.trim()) {
      return candidate.title_english.trim();
    }
    return null;
  }

  private extractYear(aired: unknown): string | undefined {
    const date = this.extractDate(aired);
    return date ? date.slice(0, 4) : undefined;
  }

  private extractDate(aired: unknown): string | undefined {
    if (!aired || typeof aired !== 'object') {
      return undefined;
    }
    const candidate = aired as JikanAired;
    if (typeof candidate.from !== 'string') {
      return undefined;
    }
    const match = candidate.from.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : undefined;
  }

  private extractImageUrl(images: unknown): string | undefined {
    if (!images || typeof images !== 'object') {
      return undefined;
    }
    const candidate = images as JikanImages;
    if (!candidate.jpg || typeof candidate.jpg !== 'object') {
      return undefined;
    }
    const jpg = candidate.jpg as JikanJpg;
    if (typeof jpg.large_image_url === 'string' && jpg.large_image_url.trim()) {
      return jpg.large_image_url.trim();
    }
    if (typeof jpg.image_url === 'string' && jpg.image_url.trim()) {
      return jpg.image_url.trim();
    }
    return undefined;
  }
}
