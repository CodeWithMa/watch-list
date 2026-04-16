import { Component, input, output, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIf, NgClass } from '@angular/common';
import { Item } from '../../models/item.model';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
import { TimeAgoComponent } from '../time-ago/time-ago.component';
import { WatchListService } from '../../services/watch-list.service';

@Component({
  selector: 'app-item-card',
  imports: [RouterLink, NgIf, NgClass, ProgressBarComponent, TimeAgoComponent],
  template: `
    <div class="border border-light-border dark:border-dark-border rounded-lg p-4 mb-4 bg-light-bg-secondary dark:bg-dark-bg-secondary shadow-light dark:shadow-dark">
      <div class="flex justify-between items-center mb-2">
        <h3 class="m-0 text-lg">
          <a [routerLink]="['/items', item().id]" class="no-underline text-light-font dark:text-dark-font hover:text-accent-primary">{{ item().title }}</a>
        </h3>
        <span class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary px-2 py-1 rounded text-xs capitalize">{{ item().type }}</span>
      </div>
      
      <div class="my-2 text-sm text-light-font-secondary dark:text-dark-font-secondary" *ngIf="item().type === 'series' && item().progress">
        <span class="episode-info">
          Episode {{ item().progress!.episode }}
          <span *ngIf="item().progress!.totalEpisodes"> of {{ item().progress!.totalEpisodes }}</span>
        </span>
        <span class="ml-2" *ngIf="progressPercent() !== null">
          ({{ progressPercent() }}% complete)
        </span>
      </div>

      <app-progress-bar 
        *ngIf="progressPercent() !== null" 
        [percentage]="progressPercent()!" 
      />

      <div class="flex gap-4 my-2 text-sm">
        <span class="px-2 py-1 rounded font-medium capitalize" [ngClass]="{
          'bg-status-not-started-bg-light dark:bg-status-not-started-bg-dark text-status-not-started-text-light dark:text-status-not-started-text-dark': item().status === 'not-started',
          'bg-status-in-progress-bg-light dark:bg-status-in-progress-bg-dark text-status-in-progress-text-light dark:text-status-in-progress-text-dark': item().status === 'in-progress',
          'bg-status-completed-bg-light dark:bg-status-completed-bg-dark text-status-completed-text-light dark:text-status-completed-text-dark': item().status === 'completed'
        }">
          {{ item().status }}
        </span>
        <app-time-ago [date]="lastWatchedDate()" />
      </div>

      <div class="flex gap-2 mt-2">
        <button (click)="onMarkWatched.emit()" [disabled]="item().status === 'completed'" class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:not-disabled:bg-light-bg-tertiary dark:hover:not-disabled:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed">
          Mark Watched
        </button>
        <button *ngIf="item().type === 'series'" (click)="onMarkCompleted.emit()" [disabled]="item().status === 'completed'" class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:not-disabled:bg-light-bg-tertiary dark:hover:not-disabled:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed">
          Mark Completed
        </button>
      </div>
    </div>
  `
})
export class ItemCardComponent {
  item = input.required<Item>();
  onMarkWatched = output<void>();
  onMarkCompleted = output<void>();

  constructor(private watchListService: WatchListService) {}

  progressPercent = computed(() => {
    return this.watchListService.calculateProgress(this.item());
  });

  lastWatchedDate = computed(() => {
    return this.watchListService.getMostRecentWatchDate(this.item());
  });
}

