import { Component, input, output, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Item } from '../../models/item.model';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
import { TimeAgoComponent } from '../time-ago/time-ago.component';
import { WatchListService } from '../../services/watch-list.service';
import { statusBadgeClass } from '../../utils/status.utils';

@Component({
  selector: 'app-item-card',
  imports: [CommonModule, RouterLink, ProgressBarComponent, TimeAgoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
          <span class="season-info">
            Season {{ item().progress!.season }}
          </span>
          <span class="episode-info ml-2">
            • Episode {{ item().progress!.episode }}
            @if (currentSeasonTotalEpisodes() !== undefined) {
              <span> of {{ currentSeasonTotalEpisodes() }}</span>
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
          [ngClass]="statusBadgeClass(true, item().status)">
          {{ item().status }}
        </span>
        <app-time-ago [date]="lastWatchedDate()" />
      </div>
    
      <div class="flex gap-2 mt-2">
        <button (click)="markWatched.emit()" [disabled]="item().status === 'completed' || item().status === 'dropped'" class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:not-disabled:bg-light-bg-tertiary dark:hover:not-disabled:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed">
          Mark Watched
        </button>
        @if (item().type === 'series') {
          <button (click)="markCompleted.emit()" [disabled]="item().status === 'completed' || item().status === 'dropped'" class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:not-disabled:bg-light-bg-tertiary dark:hover:not-disabled:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed">
            Mark Completed
          </button>
        }
        <button (click)="markDropped.emit()" [disabled]="item().status === 'completed' || item().status === 'dropped'" class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:not-disabled:bg-light-bg-tertiary dark:hover:not-disabled:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed">
          Drop
        </button>
      </div>
    </div>
    `
})
export class ItemCardComponent {
  private watchListService = inject(WatchListService);

  item = input.required<Item>();
  markWatched = output<void>();
  markCompleted = output<void>();
  markDropped = output<void>();
  protected statusBadgeClass = statusBadgeClass;

  progressPercent = computed(() => {
    return this.watchListService.calculateProgress(this.item());
  });

  currentSeasonTotalEpisodes = computed(() => {
    const item = this.item();
    if (!item.progress?.seasons) return undefined;
    const currentSeason = item.progress.seasons.find(
      (s) => s.seasonNumber === item.progress!.season
    );
    return currentSeason?.totalEpisodes;
  });

  lastWatchedDate = computed(() => {
    return this.watchListService.getMostRecentWatchDate(this.item());
  });
}

