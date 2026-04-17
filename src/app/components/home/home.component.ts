import { Component, signal, inject } from '@angular/core';
import { RoundRobinService } from '../../services/round-robin.service';
import { WatchListService } from '../../services/watch-list.service';
import { Item } from '../../models/item.model';
import { ItemCardComponent } from '../item-card/item-card.component';


@Component({
  selector: 'app-home',
  imports: [ItemCardComponent],
  template: `
    <div class="max-w-[1200px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">What should I watch now?</h1>
    
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div>
          <h2 class="text-xl mb-4 text-light-font-secondary dark:text-dark-font-secondary">Next Series</h2>
          @if (nextSeries()) {
            <div class="mb-4">
              <app-item-card
                [item]="nextSeries()!"
                (markWatched)="markSeriesWatched()"
                (markCompleted)="markSeriesCompleted()"
                />
            </div>
          } @else {
            <p class="p-8 text-center text-light-font-muted dark:text-dark-font-muted bg-light-bg-primary dark:bg-dark-bg-primary rounded-lg">No series to watch. All series are completed!</p>
          }
        </div>
    
        <div>
          <h2 class="text-xl mb-4 text-light-font-secondary dark:text-dark-font-secondary">Next Movie</h2>
          @if (nextMovie()) {
            <div class="mb-4">
              <app-item-card
                [item]="nextMovie()!"
                (markWatched)="markMovieWatched()"
                (markCompleted)="markMovieCompleted()"
                />
            </div>
          } @else {
            <p class="p-8 text-center text-light-font-muted dark:text-dark-font-muted bg-light-bg-primary dark:bg-dark-bg-primary rounded-lg">No movies to watch. All movies are completed!</p>
          }
        </div>
      </div>
    </div>
    `
})
export class HomeComponent {
  private roundRobinService = inject(RoundRobinService);
  private watchListService = inject(WatchListService);

  nextSeries = signal<Item | null>(null);
  nextMovie = signal<Item | null>(null);

  constructor() {
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