import { Injectable, inject, computed } from '@angular/core';
import { WatchListService } from './watch-list.service';

@Injectable({
  providedIn: 'root'
})
export class RoundRobinService {
  private watchListService = inject(WatchListService);


  nextSeries = computed(() => {
    const series = this.watchListService.inProgressSeries();

    if (series.length === 0) {
      return null;
    }

    const sorted = [...series].sort((a, b) => {
      const aDate = this.watchListService.getMostRecentWatchDate(a);
      const bDate = this.watchListService.getMostRecentWatchDate(b);
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    for (const s of sorted) {
      if (this.canSuggestSeries(s.id)) {
        return s;
      }
    }

    return sorted[0];
  });

  nextMovie = computed(() => {
    const movies = this.watchListService.inProgressMovies();

    if (movies.length === 0) {
      return null;
    }

    return [...movies].sort((a, b) => {
      const aDate = this.watchListService.getMostRecentWatchDate(a);
      const bDate = this.watchListService.getMostRecentWatchDate(b);
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    })[0];
  });

  private canSuggestSeries(seriesId: string): boolean {
    const series = this.watchListService.inProgressSeries();

    if (series.length <= 1) {
      return true;
    }

    const targetSeries = series.find(s => s.id === seriesId);
    if (!targetSeries) {
      return false;
    }

    const otherSeries = series.filter(s => s.id !== seriesId);

    const allOthersWatched = otherSeries.every(s => {
      return (s.watchHistory && s.watchHistory.length > 0);
    });

    return allOthersWatched;
  }
}