import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RoundRobinService } from '../../services/round-robin.service';
import { WatchListService } from '../../services/watch-list.service';
import { ItemCardComponent } from '../item-card/item-card.component';


@Component({
  selector: 'app-home',
  imports: [ItemCardComponent, CommonModule, RouterLink],
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
                (markDropped)="markSeriesDropped()"
                />
            </div>
          } @else {
            <p class="p-8 text-center text-light-font-muted dark:text-dark-font-muted bg-light-bg-primary dark:bg-dark-bg-primary rounded-lg">
              @if (hasSeries()) {
                No series currently being watched
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
                (markDropped)="markMovieDropped()"
                />
            </div>
          } @else {
            <p class="p-8 text-center text-light-font-muted dark:text-dark-font-muted bg-light-bg-primary dark:bg-dark-bg-primary rounded-lg">
              @if (hasMovies()) {
                No movies currently being watched
              } @else {
                No movies in your watch list
              }
            </p>
          }
        </div>
      </div>

      <div class="border-t border-light-border dark:border-dark-border pt-8 mt-8">
        <h2 class="text-xl mb-4 text-light-font-secondary dark:text-dark-font-secondary">Backlog</h2>
        @if (backlogItems().length > 0) {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (item of backlogItems(); track item.id) {
              <div class="border border-light-border dark:border-dark-border rounded-lg p-4 bg-light-bg-secondary dark:bg-dark-bg-secondary shadow-light dark:shadow-dark">
                <div class="flex justify-between items-center mb-2">
                  <h3 class="m-0 text-lg">
                    <a [routerLink]="['/items', item.id]" class="no-underline text-light-font dark:text-dark-font hover:text-accent-primary">{{ item.title }}</a>
                  </h3>
                  <span class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary px-2 py-1 rounded text-xs capitalize">{{ item.type }}</span>
                </div>
                <div class="flex gap-2 mt-2">
                  <button (click)="startBacklogItem(item.id)" class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary">
                    Add to currently watching
                  </button>
                  <button (click)="dropBacklogItem(item.id)" class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary">
                    Drop
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <p class="p-8 text-center text-light-font-muted dark:text-dark-font-muted bg-light-bg-primary dark:bg-dark-bg-primary rounded-lg">No items in backlog</p>
        }
      </div>
    </div>
  `
})
export class HomeComponent {
  private roundRobinService = inject(RoundRobinService);
  private watchListService = inject(WatchListService);

  nextSeries = this.roundRobinService.nextSeries;
  nextMovie = this.roundRobinService.nextMovie;
  backlogItems = computed(() => 
    this.watchListService.items()
      .filter(item => item.status === 'not-started')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );

  protected hasSeries = computed(() => this.watchListService.items().some(i => i.type === 'series'));
  protected hasMovies = computed(() => this.watchListService.items().some(i => i.type === 'movie'));

  markSeriesWatched(): void {
    const series = this.nextSeries();
    if (series) {
      this.watchListService.markWatched(series.id);
    }
  }

  markSeriesCompleted(): void {
    const series = this.nextSeries();
    if (series) {
      this.watchListService.markCompleted(series.id);
    }
  }

  markMovieWatched(): void {
    const movie = this.nextMovie();
    if (movie) {
      this.watchListService.markWatched(movie.id);
    }
  }

  markMovieCompleted(): void {
    const movie = this.nextMovie();
    if (movie) {
      this.watchListService.markCompleted(movie.id);
    }
  }

  markSeriesDropped(): void {
    const series = this.nextSeries();
    if (series) {
      this.watchListService.markDropped(series.id);
    }
  }

  markMovieDropped(): void {
    const movie = this.nextMovie();
    if (movie) {
      this.watchListService.markDropped(movie.id);
    }
  }

  startBacklogItem(itemId: string): void {
    this.watchListService.markStarted(itemId);
  }

  dropBacklogItem(itemId: string): void {
    this.watchListService.markDropped(itemId);
  }
}