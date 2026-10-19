import { DestroyRef, Injectable, NgZone, inject, computed, effect, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { WatchListService } from './watch-list.service';
import { ReadonlyItem as Item } from '../models/item.model';
import { getMostRecentWatchDate } from '../utils/progress.utils';
import { getCurrentEpisodeAirDate, startOfLocalDay } from '../domain/episode-release';
import { activeDeferralUntil } from '../domain/availability-deferral';

@Injectable({
  providedIn: 'root',
})
export class RoundRobinService {
  private watchListService = inject(WatchListService);
  private document = inject(DOCUMENT);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);
  private now = signal(Date.now());

  constructor() {
    const window = this.document.defaultView;
    if (!window) return;

    let timer: number;
    const refresh = () => {
      const now = new Date();
      this.now.set(now.getTime());
      window.clearTimeout(timer);
      const midnight = startOfLocalDay(now);
      midnight.setDate(midnight.getDate() + 1);
      const expiries = this.watchListService.items().flatMap((item) => {
        const until = activeDeferralUntil(item, now.getTime());
        return until ? [new Date(until).getTime()] : [];
      });
      const nextRefresh = Math.min(midnight.getTime(), ...expiries);
      this.zone.runOutsideAngular(() => {
        timer = window.setTimeout(refresh, nextRefresh - now.getTime());
      });
    };
    const onVisibilityChange = () => {
      if (this.document.visibilityState === 'visible') refresh();
    };
    refresh();
    // Re-arm the timer when a deferral is saved, cleared, or loaded.
    effect(refresh);
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

    const today = new Date(this.now());
    const watchable = sorted.filter(
      (s) => this.hasAiredCurrentEpisode(s, today) && !this.activeDeferralUntil(s),
    );
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

  activeDeferralUntil(item: Item) {
    return activeDeferralUntil(item, this.now());
  }

  allDeferredUntil = computed(() => {
    const aired = this.watchListService
      .inProgressSeries()
      .filter((item) => this.hasAiredCurrentEpisode(item, new Date(this.now())));
    const expiries = aired.map((item) => this.activeDeferralUntil(item));
    if (!expiries.length || expiries.some((until) => !until)) return null;
    return expiries.reduce<string | null>(
      (earliest, until) =>
        !earliest || (until && Date.parse(until) < Date.parse(earliest)) ? until : earliest,
      null,
    );
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

  private canSuggestSeries(seriesId: string, series: readonly Item[]): boolean {
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
