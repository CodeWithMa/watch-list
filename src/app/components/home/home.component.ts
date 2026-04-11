import { Component, inject, signal, effect } from '@angular/core';
import { RoundRobinService } from '../../services/round-robin.service';
import { WatchListService } from '../../services/watch-list.service';
import { StorageService } from '../../services/storage.service';
import { Item } from '../../models/item.model';
import { ItemCardComponent } from '../item-card/item-card.component';
import { NgIf } from '@angular/common';
import { createAsyncAction, withAsyncAction } from '../../utils/async-action';

@Component({
  selector: 'app-home',
  imports: [ItemCardComponent, NgIf],
  template: `
    <div class="home-container">
      <h1>What should I watch now?</h1>

      <div *ngIf="state.error()" class="error-message">{{ state.error() }}</div>

      <div class="next-items">
        <div class="next-item-section">
          <h2>Next Series</h2>
          <div *ngIf="nextSeries(); else noSeries" class="next-item-card">
            <app-item-card 
              [item]="nextSeries()!" 
              (onMarkWatched)="markSeriesWatched()"
              (onMarkCompleted)="markSeriesCompleted()"
              [disabled]="state.busy()"
            />
          </div>
          <ng-template #noSeries>
            <p class="empty-message">No series to watch. All series are completed!</p>
          </ng-template>
        </div>

        <div class="next-item-section">
          <h2>Next Movie</h2>
          <div *ngIf="nextMovie(); else noMovie" class="next-item-card">
            <app-item-card 
              [item]="nextMovie()!" 
              (onMarkWatched)="markMovieWatched()"
              (onMarkCompleted)="markMovieCompleted()"
              [disabled]="state.busy()"
            />
          </div>
          <ng-template #noMovie>
            <p class="empty-message">No movies to watch. All movies are completed!</p>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .home-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 2rem;
      color: light-dark(var(--light-font-color), var(--dark-font-color));
    }

    .next-items {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 2rem;
    }

    @media (max-width: 768px) {
      .next-items {
        grid-template-columns: 1fr;
      }
    }

    .next-item-section h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: light-dark(var(--light-font-secondary), var(--dark-font-secondary));
    }

    .next-item-card {
      margin-bottom: 1rem;
    }

    .empty-message {
      padding: 2rem;
      text-align: center;
      color: light-dark(var(--light-font-muted), var(--dark-font-muted));
      background: light-dark(var(--light-bg-primary), var(--dark-bg-primary));
      border-radius: 8px;
    }

    .error-message {
      padding: 1rem;
      background: light-dark(#f8d7da, #721c24);
      color: light-dark(#721c24, #f8d7da);
      border-radius: 4px;
      margin-bottom: 1rem;
    }
  `]
})
export class HomeComponent {
  private readonly roundRobinService = inject(RoundRobinService);
  private readonly watchListService = inject(WatchListService);
  private readonly storageService = inject(StorageService);

  state = createAsyncAction();
  nextSeries = signal<Item | null>(null);
  nextMovie = signal<Item | null>(null);

  constructor() {
    effect(() => {
      const data = this.storageService.data();
      if (data) {
        this.updateNextItems();
      }
    });
  }

  updateNextItems(): void {
    this.nextSeries.set(this.roundRobinService.getNextSeriesToWatch());
    this.nextMovie.set(this.roundRobinService.getNextMovieToWatch());
  }

  markSeriesWatched = withAsyncAction(
    async () => {
      const series = this.nextSeries();
      if (series) {
        await this.watchListService.markWatched(series.id);
      }
    },
    this.state
  );

  markSeriesCompleted = withAsyncAction(
    async () => {
      const series = this.nextSeries();
      if (series) {
        await this.watchListService.markCompleted(series.id);
      }
    },
    this.state
  );

  markMovieWatched = withAsyncAction(
    async () => {
      const movie = this.nextMovie();
      if (movie) {
        await this.watchListService.markWatched(movie.id);
      }
    },
    this.state
  );

  markMovieCompleted = withAsyncAction(
    async () => {
      const movie = this.nextMovie();
      if (movie) {
        await this.watchListService.markCompleted(movie.id);
      }
    },
    this.state
  );
}