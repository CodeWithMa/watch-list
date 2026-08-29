import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { SeriesDetails, Suggestion } from '../models/suggestion.model';
import { ItemType } from '../models/item.model';
import { ProviderSettingsService } from './provider-settings.service';
import {
  SUGGESTION_MIN_QUERY_LENGTH,
  SUGGESTION_PER_SOURCE_LIMIT,
} from '../domain/suggestion.constants';

interface AnilistSearchResponse {
  data?: {
    Page?: {
      media?: unknown[];
    };
  };
}

interface AnilistDetailsResponse {
  data?: {
    Media?: unknown;
  };
}

interface AnilistMedia {
  id?: unknown;
  title?: unknown;
  format?: unknown;
  episodes?: unknown;
  startDate?: unknown;
  coverImage?: unknown;
  description?: unknown;
}

interface AnilistTitle {
  romaji?: unknown;
  english?: unknown;
  native?: unknown;
}

interface AnilistCoverImage {
  extraLarge?: unknown;
  large?: unknown;
}

interface AnilistFuzzyDate {
  year?: unknown;
  month?: unknown;
  day?: unknown;
}

const ANILIST_FORMAT_MAP: Record<string, ItemType> = {
  TV: 'series',
  TV_SHORT: 'series',
  MOVIE: 'movie',
  OVA: 'ova',
  ONA: 'ona',
};

const ANILIST_SEARCH_QUERY_TEMPLATE = `
query ($search: String) {
  Page(page: 1, perPage: ${SUGGESTION_PER_SOURCE_LIMIT}) {
    media(search: $search, type: ANIME, isAdult: __IS_ADULT__, sort: POPULARITY_DESC) {
      id
      title { romaji english native }
      format
      episodes
      startDate { year month day }
      coverImage { extraLarge large }
      description
    }
  }
}
`;

const ANILIST_DETAILS_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    format
    episodes
    startDate { year month day }
  }
}
`;

@Injectable({
  providedIn: 'root',
})
export class AnilistSuggestionService {
  private readonly http = inject(HttpClient);
  private readonly providerSettings = inject(ProviderSettingsService);

  search(query: string): Observable<Suggestion[]> {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < SUGGESTION_MIN_QUERY_LENGTH) {
      return of([]);
    }

    const gqlQuery = ANILIST_SEARCH_QUERY_TEMPLATE.replace(
      '__IS_ADULT__',
      String(this.providerSettings.isAdultIncluded()),
    );

    return this.http
      .post<AnilistSearchResponse>(
        'https://graphql.anilist.co',
        {
          query: gqlQuery,
          variables: { search: trimmedQuery },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      )
      .pipe(map((response) => this.mapResults(response.data?.Page?.media ?? [])));
  }

  getAnimeDetails(anilistId: number): Observable<SeriesDetails | null> {
    if (!Number.isInteger(anilistId) || anilistId < 1) {
      return of(null);
    }

    return this.http
      .post<AnilistDetailsResponse>(
        'https://graphql.anilist.co',
        {
          query: ANILIST_DETAILS_QUERY,
          variables: { id: anilistId },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      )
      .pipe(map((response) => this.mapDetails(response.data?.Media)));
  }

  private mapResults(results: unknown[]): Suggestion[] {
    return results
      .map((result) => this.mapResult(result))
      .filter((s): s is Suggestion => s !== null)
      .slice(0, SUGGESTION_PER_SOURCE_LIMIT);
  }

  private mapResult(result: unknown): Suggestion | null {
    if (!result || typeof result !== 'object') {
      return null;
    }

    const candidate = result as AnilistMedia;
    if (typeof candidate.id !== 'number') {
      return null;
    }

    const type = this.mapType(candidate.format);
    if (!type) {
      return null;
    }

    const title = this.resolveTitle(candidate.title);
    if (!title) {
      return null;
    }

    return {
      id: candidate.id,
      source: 'anilist',
      title,
      type,
      year: this.extractYear(candidate.startDate),
      overview: this.extractOverview(candidate.description),
      posterUrl: this.extractImageUrl(candidate.coverImage),
    };
  }

  private mapDetails(data: unknown): SeriesDetails | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const candidate = data as AnilistMedia;
    const season = this.buildSeason(candidate);
    return { seasons: season ? [season] : [] };
  }

  private buildSeason(candidate: AnilistMedia) {
    const totalEpisodes =
      typeof candidate.episodes === 'number' && candidate.episodes >= 1
        ? candidate.episodes
        : undefined;

    const firstEpisodeAirDate = this.extractDate(candidate.startDate);

    if (totalEpisodes === undefined && !firstEpisodeAirDate) {
      return null;
    }

    return {
      seasonNumber: 1,
      totalEpisodes,
      firstEpisodeAirDate,
    };
  }

  private mapType(rawFormat: unknown): ItemType | null {
    if (typeof rawFormat !== 'string') {
      return null;
    }
    return ANILIST_FORMAT_MAP[rawFormat] ?? null;
  }

  private resolveTitle(title: unknown): string | null {
    if (!title || typeof title !== 'object') {
      return null;
    }
    const candidate = title as AnilistTitle;
    const pref = this.providerSettings.getTitlePreference();
    for (const lang of pref) {
      if (lang === 'romaji' && typeof candidate.romaji === 'string' && candidate.romaji.trim()) {
        return candidate.romaji.trim();
      }
      if (lang === 'english' && typeof candidate.english === 'string' && candidate.english.trim()) {
        return candidate.english.trim();
      }
      if (lang === 'native' && typeof candidate.native === 'string' && candidate.native.trim()) {
        return candidate.native.trim();
      }
    }
    return null;
  }

  private extractYear(startDate: unknown): string | undefined {
    if (!startDate || typeof startDate !== 'object') {
      return undefined;
    }
    const candidate = startDate as AnilistFuzzyDate;
    if (typeof candidate.year === 'number' && candidate.year >= 1000) {
      return String(candidate.year);
    }
    const date = this.extractDate(startDate);
    return date ? date.slice(0, 4) : undefined;
  }

  private extractDate(startDate: unknown): string | undefined {
    if (!startDate || typeof startDate !== 'object') {
      return undefined;
    }
    const candidate = startDate as AnilistFuzzyDate;
    if (
      typeof candidate.year !== 'number' ||
      typeof candidate.month !== 'number' ||
      typeof candidate.day !== 'number'
    ) {
      return undefined;
    }
    if (
      !Number.isInteger(candidate.year) ||
      !Number.isInteger(candidate.month) ||
      !Number.isInteger(candidate.day)
    ) {
      return undefined;
    }
    if (candidate.month < 1 || candidate.month > 12 || candidate.day < 1 || candidate.day > 31) {
      return undefined;
    }
    const month = String(candidate.month).padStart(2, '0');
    const day = String(candidate.day).padStart(2, '0');
    return `${candidate.year}-${month}-${day}`;
  }

  private extractImageUrl(coverImage: unknown): string | undefined {
    if (!coverImage || typeof coverImage !== 'object') {
      return undefined;
    }
    const candidate = coverImage as AnilistCoverImage;
    if (typeof candidate.extraLarge === 'string' && candidate.extraLarge.trim()) {
      return candidate.extraLarge.trim();
    }
    if (typeof candidate.large === 'string' && candidate.large.trim()) {
      return candidate.large.trim();
    }
    return undefined;
  }

  private extractOverview(description: unknown): string | undefined {
    if (typeof description !== 'string' || !description.trim()) {
      return undefined;
    }
    const stripped = this.stripHtml(description).trim();
    return stripped ? stripped : undefined;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}
