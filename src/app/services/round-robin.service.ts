import { Injectable, inject, computed } from '@angular/core';
import { WatchListService } from './watch-list.service';
import { Item } from '../models/item.model';

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

    const watchable = sorted.filter(s => this.hasAiredCurrentEpisode(s));
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
      const aDate = this.watchListService.getMostRecentWatchDate(a);
      const bDate = this.watchListService.getMostRecentWatchDate(b);
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    })[0];
  });

  private canSuggestSeries(seriesId: string, series: Item[]): boolean {
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

  hasAiredCurrentEpisode(series: Item, today = new Date()): boolean {
    if (series.type !== 'series' || !series.progress) {
      return true;
    }

    const currentSeason = series.progress.seasons.find(
      s => s.seasonNumber === series.progress!.season
    );
    if (!currentSeason?.firstEpisodeAirDate) {
      return true;
    }

    const airDate = this.getEpisodeAirDate(currentSeason.firstEpisodeAirDate, series.progress.episode);
    if (!airDate) {
      return true;
    }

    return airDate.getTime() <= this.startOfLocalDay(today).getTime();
  }

  private getEpisodeAirDate(firstEpisodeAirDate: string, episode: number): Date | null {
    const [year, month, day] = firstEpisodeAirDate.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }

    const airDate = new Date(year, month - 1, day);
    airDate.setDate(airDate.getDate() + Math.max(0, episode - 1) * 7);
    return airDate;
  }

  private startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
