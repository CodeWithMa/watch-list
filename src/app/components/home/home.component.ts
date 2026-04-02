import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoundRobinService } from '../../services/round-robin.service';
import { WatchListService } from '../../services/watch-list.service';
import { Item } from '../../models/item.model';
import { ItemCardComponent } from '../item-card/item-card.component';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ItemCardComponent, NgIf],
  template: `
    <div class="home-container">
      <h1>What should I watch now?</h1>

      <div class="next-items">
        <div class="next-item-section">
          <h2>Next Series</h2>
          <div *ngIf="nextSeries(); else noSeries" class="next-item-card">
            <app-item-card 
              [item]="nextSeries()!" 
              (onMarkWatched)="markSeriesWatched()"
              (onMarkCompleted)="markSeriesCompleted()"
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
            />
          </div>
          <ng-template #noMovie>
            <p class="empty-message">No movies to watch. All movies are completed!</p>
          </ng-template>
        </div>
      </div>

      <div class="quick-actions">
        <a [routerLink]="['/items']" class="action-button">View All Items</a>
        <a [routerLink]="['/items/add']" class="action-button">Add New Item</a>
        <a [routerLink]="['/history']" class="action-button">Watch History</a>
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

    .quick-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 2rem;
    }

    .action-button {
      padding: 0.75rem 1.5rem;
      background: var(--accent-primary);
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
      transition: background 0.2s;
    }

    .action-button:hover {
      background: var(--accent-primary-hover);
    }
  `]
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

