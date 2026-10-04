import { DestroyRef, Injectable, NgZone, inject, computed, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { WatchListService } from './watch-list.service';
import { Item } from '../models/item.model';
import { getMostRecentWatchDate } from '../utils/progress.utils';
import { getCurrentEpisodeAirDate, startOfLocalDay } from '../domain/episode-release';

@Injectable({
  providedIn: 'root',
})
export class RoundRobinService {
  private watchListService = inject(WatchListService);
  private document = inject(DOCUMENT);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);
  private today = signal(startOfLocalDay(new Date()).getTime());

  constructor() {
    const window = this.document.defaultView;
    if (!window) return;

    let timer: number;
    const refresh = () => {
      const now = new Date();
      this.today.set(startOfLocalDay(now).getTime());
      window.clearTimeout(timer);
      const midnight = startOfLocalDay(now);
      midnight.setDate(midnight.getDate() + 1);
      this.zone.runOutsideAngular(() => {
        timer = window.setTimeout(refresh, midnight.getTime() - now.getTime());
      });
    };
    const onVisibilityChange = () => {
      if (this.document.visibilityState === 'visible') refresh();
    };
    refresh();
    window.addEventListener('focus', refresh);
    this.document.addEventListener('visibilitychange', onVisibilityChange);
    this.destroyRef.onDestroy(() => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      this.document.removeEventListener('visibilitychange', onVisibilityChange);
    });
  }

  nextSeries = computed(() => {
    const series = this.watchListService.inProgressSeries();

    if (series.length === 0) {
      return null;
    }

    const sorted = [...series].sort((a, b) => {
      const aDate = getMostRecentWatchDate(a);
      const bDate = getMostRecentWatchDate(b);
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    const today = new Date(this.today());
    const watchable = sorted.filter((s) => this.hasAiredCurrentEpisode(s, today));
    if (watchable.length === 0) {
      return null;
    }

    for (const s of watchable) {
      if (this.canSuggestSeries(s.id, watchable)) {
        return s;
      }
    }

    return watchable[0];
  });

  nextMovie = computed(() => {
    const movies = this.watchListService.inProgressMovies();

    if (movies.length === 0) {
      return null;
    }

    return [...movies].sort((a, b) => {
      const aDate = getMostRecentWatchDate(a);
      const bDate = getMostRecentWatchDate(b);
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    })[0];
  });

  private canSuggestSeries(seriesId: string, series: Item[]): boolean {
    if (series.length <= 1) {
      return true;
    }

    const targetSeries = series.find((s) => s.id === seriesId);
    if (!targetSeries) {
      return false;
    }

    const otherSeries = series.filter((s) => s.id !== seriesId);

    const allOthersWatched = otherSeries.every((s) => {
      return s.watchHistory && s.watchHistory.length > 0;
    });

    return allOthersWatched;
  }

  hasAiredCurrentEpisode(series: Item, today = new Date()): boolean {
    const airDate = getCurrentEpisodeAirDate(series);
    return !airDate || airDate.getTime() <= startOfLocalDay(today).getTime();
  }
}
