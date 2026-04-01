import { Injectable } from '@angular/core';
import { WatchListService } from './watch-list.service';
import { Item } from '../models/item.model';

@Injectable({
  providedIn: 'root'
})
export class RoundRobinService {
  constructor(private watchListService: WatchListService) {}

  getNextSeriesToWatch(): Item | null {
    const allSeries = this.watchListService.getItemsByType('series');
    const nonCompletedSeries = allSeries.filter(item => item.status !== 'completed');

    if (nonCompletedSeries.length === 0) {
      return null;
    }

    const sorted = [...nonCompletedSeries].sort((a, b) => {
      const aDate = this.getMostRecentWatchDate(a);
      const bDate = this.getMostRecentWatchDate(b);
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    for (const series of sorted) {
      if (this.canSuggestSeries(series.id)) {
        return series;
      }
    }

    return sorted[0];
  }

  getNextMovieToWatch(): Item | null {
    const allMovies = this.watchListService.getItemsByType('movie');
    const nonCompletedMovies = allMovies.filter(item => item.status !== 'completed');

    if (nonCompletedMovies.length === 0) {
      return null;
    }

    const sorted = [...nonCompletedMovies].sort((a, b) => {
      const aDate = this.getMostRecentWatchDate(a);
      const bDate = this.getMostRecentWatchDate(b);
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    return sorted[0];
  }

  canSuggestSeries(seriesId: string): boolean {
    const allSeries = this.watchListService.getItemsByType('series');
    const nonCompletedSeries = allSeries.filter(item => item.status !== 'completed');

    if (nonCompletedSeries.length <= 1) {
      return true;
    }

    const targetSeries = allSeries.find(s => s.id === seriesId);
    if (!targetSeries || targetSeries.status === 'completed') {
      return false;
    }

    const otherSeries = nonCompletedSeries.filter(s => s.id !== seriesId);

    const allOthersWatched = otherSeries.every(series => {
      return (series.watchHistory && series.watchHistory.length > 0);
    });

    return allOthersWatched;
  }

  private getMostRecentWatchDate(item: Item): string {
    if (item.watchHistory && item.watchHistory.length > 0) {
      const sorted = [...item.watchHistory].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return sorted[0].date;
    }
    return item.createdAt;
  }
}

