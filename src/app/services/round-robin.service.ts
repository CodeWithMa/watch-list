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

    // Sort by lastWatchedAt ascending
    const sorted = [...nonCompletedSeries].sort((a, b) => {
      return new Date(a.lastWatchedAt).getTime() - new Date(b.lastWatchedAt).getTime();
    });

    // Find the first series that can be suggested (round-robin rule)
    for (const series of sorted) {
      if (this.canSuggestSeries(series.id)) {
        return series;
      }
    }

    // If no series can be suggested yet, return the one with oldest lastWatchedAt
    return sorted[0];
  }

  getNextMovieToWatch(): Item | null {
    const allMovies = this.watchListService.getItemsByType('movie');
    const nonCompletedMovies = allMovies.filter(item => item.status !== 'completed');

    if (nonCompletedMovies.length === 0) {
      return null;
    }

    // Sort by lastWatchedAt ascending
    const sorted = [...nonCompletedMovies].sort((a, b) => {
      return new Date(a.lastWatchedAt).getTime() - new Date(b.lastWatchedAt).getTime();
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

    // Get all other non-completed series
    const otherSeries = nonCompletedSeries.filter(s => s.id !== seriesId);

    // Check if at least one episode of every other series has been watched
    // A series is considered "watched at least once" if it's in-progress or has been watched
    const allOthersWatched = otherSeries.every(series => {
      // If status is in-progress, at least one episode has been watched
      if (series.status === 'in-progress') {
        return true;
      }
      // If not-started but has a lastWatchedAt that's not the creation date, it was watched
      // For simplicity, we check if progress exists and episode > 0
      if (series.progress && series.progress.episode > 0) {
        return true;
      }
      // Check if lastWatchedAt is different from createdAt (meaning it was watched)
      return series.lastWatchedAt !== series.createdAt;
    });

    return allOthersWatched;
  }

  updateLastWatched(itemId: string): void {
    const item = this.watchListService.getItemById(itemId);
    if (!item) return;

    this.watchListService.updateItem({
      ...item,
      lastWatchedAt: new Date().toISOString()
    });
  }
}

