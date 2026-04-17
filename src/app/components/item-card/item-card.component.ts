import { Component, input, output, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Item } from '../../models/item.model';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
import { TimeAgoComponent } from '../time-ago/time-ago.component';
import { WatchListService } from '../../services/watch-list.service';

@Component({
  selector: 'app-item-card',
  imports: [RouterLink, ProgressBarComponent, TimeAgoComponent],
  template: `
    <div class="border border-light-border dark:border-dark-border rounded-lg p-4 mb-4 bg-light-bg-secondary dark:bg-dark-bg-secondary shadow-light dark:shadow-dark">
      <div class="flex justify-between items-center mb-2">
        <h3 class="m-0 text-lg">
          <a [routerLink]="['/items', item().id]" class="no-underline text-light-font dark:text-dark-font hover:text-accent-primary">{{ item().title }}</a>
        </h3>
        <span class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary px-2 py-1 rounded text-xs capitalize">{{ item().type }}</span>
      </div>
    
      @if (item().type === 'series' && item().progress) {
        <div class="my-2 text-sm text-light-font-secondary dark:text-dark-font-secondary">
          <span class="episode-info">
            Episode {{ item().progress!.episode }}
            @if (item().progress!.totalEpisodes) {
              <span> of {{ item().progress!.totalEpisodes }}</span>
            }
          </span>
          @if (progressPercent() !== null) {
            <span class="ml-2">
              ({{ progressPercent() }}% complete)
            </span>
          }
        </div>
      }
    
      @if (progressPercent() !== null) {
        <app-progress-bar
          [percentage]="progressPercent()!"
          />
      }
    
      <div class="flex gap-4 my-2 text-sm">
        <span class="px-2 py-1 rounded font-medium capitalize"
          [class.bg-status-not-started-bg-light]="item().status === 'not-started'"
          [class.dark:bg-status-not-started-bg-dark]="item().status === 'not-started'"
          [class.text-status-not-started-text-light]="item().status === 'not-started'"
          [class.dark:text-status-not-started-text-dark]="item().status === 'not-started'"
          [class.bg-status-in-progress-bg-light]="item().status === 'in-progress'"
          [class.dark:bg-status-in-progress-bg-dark]="item().status === 'in-progress'"
          [class.text-status-in-progress-text-light]="item().status === 'in-progress'"
          [class.dark:text-status-in-progress-text-dark]="item().status === 'in-progress'"
          [class.bg-status-completed-bg-light]="item().status === 'completed'"
          [class.dark:bg-status-completed-bg-dark]="item().status === 'completed'"
          [class.text-status-completed-text-light]="item().status === 'completed'"
          [class.dark:text-status-completed-text-dark]="item().status === 'completed'">
          {{ item().status }}
        </span>
        <app-time-ago [date]="lastWatchedDate()" />
      </div>
    
      <div class="flex gap-2 mt-2">
        <button (click)="markWatched.emit()" [disabled]="item().status === 'completed'" class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:not-disabled:bg-light-bg-tertiary dark:hover:not-disabled:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed">
          Mark Watched
        </button>
        @if (item().type === 'series') {
          <button (click)="markCompleted.emit()" [disabled]="item().status === 'completed'" class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:not-disabled:bg-light-bg-tertiary dark:hover:not-disabled:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed">
            Mark Completed
          </button>
        }
      </div>
    </div>
    `
})
export class ItemCardComponent {
  private watchListService = inject(WatchListService);

  item = input.required<Item>();
  markWatched = output<void>();
  markCompleted = output<void>();

  progressPercent = computed(() => {
    return this.watchListService.calculateProgress(this.item());
  });

  lastWatchedDate = computed(() => {
    return this.watchListService.getMostRecentWatchDate(this.item());
  });
}

