import { Component, signal } from '@angular/core';
import { RoundRobinService } from '../../services/round-robin.service';
import { WatchListService } from '../../services/watch-list.service';
import { Item } from '../../models/item.model';
import { ItemCardComponent } from '../item-card/item-card.component';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-home',
  imports: [ItemCardComponent, NgIf],
  template: `
    <div class="max-w-[1200px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">What should I watch now?</h1>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div>
          <h2 class="text-xl mb-4 text-light-font-secondary dark:text-dark-font-secondary">Next Series</h2>
          <div *ngIf="nextSeries(); else noSeries" class="mb-4">
            <app-item-card 
              [item]="nextSeries()!" 
              (onMarkWatched)="markSeriesWatched()"
              (onMarkCompleted)="markSeriesCompleted()"
            />
          </div>
          <ng-template #noSeries>
            <p class="p-8 text-center text-light-font-muted dark:text-dark-font-muted bg-light-bg-primary dark:bg-dark-bg-primary rounded-lg">No series to watch. All series are completed!</p>
          </ng-template>
        </div>

        <div>
          <h2 class="text-xl mb-4 text-light-font-secondary dark:text-dark-font-secondary">Next Movie</h2>
          <div *ngIf="nextMovie(); else noMovie" class="mb-4">
            <app-item-card 
              [item]="nextMovie()!" 
              (onMarkWatched)="markMovieWatched()"
              (onMarkCompleted)="markMovieCompleted()"
            />
          </div>
          <ng-template #noMovie>
            <p class="p-8 text-center text-light-font-muted dark:text-dark-font-muted bg-light-bg-primary dark:bg-dark-bg-primary rounded-lg">No movies to watch. All movies are completed!</p>
          </ng-template>
        </div>
      </div>
    </div>
  `
})
export class HomeComponent {
  nextSeries = signal<Item | null>(null);
  nextMovie = signal<Item | null>(null);

  constructor(
    private roundRobinService: RoundRobinService,
    private watchListService: WatchListService
  ) {
    this.updateNextItems();
  }

  updateNextItems(): void {
    this.nextSeries.set(this.roundRobinService.getNextSeriesToWatch());
    this.nextMovie.set(this.roundRobinService.getNextMovieToWatch());
  }

  markSeriesWatched(): void {
    const series = this.nextSeries();
    if (series) {
      this.watchListService.markWatched(series.id);
      this.updateNextItems();
    }
  }

  markSeriesCompleted(): void {
    const series = this.nextSeries();
    if (series) {
      this.watchListService.markCompleted(series.id);
      this.updateNextItems();
    }
  }

  markMovieWatched(): void {
    const movie = this.nextMovie();
    if (movie) {
      this.watchListService.markWatched(movie.id);
      this.updateNextItems();
    }
  }

  markMovieCompleted(): void {
    const movie = this.nextMovie();
    if (movie) {
      this.watchListService.markCompleted(movie.id);
      this.updateNextItems();
    }
  }
}