import { Component, signal, computed, inject } from '@angular/core';
import { RoundRobinService } from '../../services/round-robin.service';
import { WatchListService } from '../../services/watch-list.service';
import { StorageService } from '../../services/storage.service';
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
            <p class="p-8 text-center text-light-font-muted dark:text-dark-font-muted bg-light-bg-primary dark:bg-dark-bg-primary rounded-lg">
              @if (hasSeries()) {
                No series available to watch ({{ seriesCompletedCount() }} completed, {{ seriesDroppedCount() }} dropped)
              } @else {
                No series in your watch list
              }
            </p>
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
            <p class="p-8 text-center text-light-font-muted dark:text-dark-font-muted bg-light-bg-primary dark:bg-dark-bg-primary rounded-lg">
              @if (hasMovies()) {
                No movies available to watch ({{ movieCompletedCount() }} completed, {{ movieDroppedCount() }} dropped)
              } @else {
                No movies in your watch list
              }
            </p>
          }
        </div>
      </div>
    </div>
    `
})
export class HomeComponent {
  private roundRobinService = inject(RoundRobinService);
  private watchListService = inject(WatchListService);
  private storageService = inject(StorageService);

  nextSeries = signal<Item | null>(null);
  nextMovie = signal<Item | null>(null);

  private allItems = computed(() => {
    const data = this.storageService.getDataSignal()();
    return data ? Object.values(data.items) : [];
  });

  private seriesItems = computed(() => this.allItems().filter(i => i.type === 'series'));
  private movieItems = computed(() => this.allItems().filter(i => i.type === 'movie'));

  protected seriesCompletedCount = computed(() => this.seriesItems().filter(i => i.status === 'completed').length);
  protected seriesDroppedCount = computed(() => this.seriesItems().filter(i => i.status === 'dropped').length);
  protected hasSeries = computed(() => this.seriesItems().length > 0);

  protected movieCompletedCount = computed(() => this.movieItems().filter(i => i.status === 'completed').length);
  protected movieDroppedCount = computed(() => this.movieItems().filter(i => i.status === 'dropped').length);
  protected hasMovies = computed(() => this.movieItems().length > 0);

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