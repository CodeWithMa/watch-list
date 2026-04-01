import { Component, input, output, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { Item } from '../../models/item.model';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
import { TimeAgoComponent } from '../time-ago/time-ago.component';
import { WatchListService } from '../../services/watch-list.service';

@Component({
  selector: 'app-item-card',
  imports: [RouterLink, NgIf, ProgressBarComponent, TimeAgoComponent],
  template: `
    <div class="item-card">
      <div class="item-header">
        <h3>
          <a [routerLink]="['/items', item().id]">{{ item().title }}</a>
        </h3>
        <span class="item-type">{{ item().type }}</span>
      </div>
      
      <div class="item-info" *ngIf="item().type === 'series' && item().progress">
        <span class="episode-info">
          Episode {{ item().progress!.episode }}
          <span *ngIf="item().progress!.totalEpisodes"> of {{ item().progress!.totalEpisodes }}</span>
        </span>
        <span class="progress-percent" *ngIf="progressPercent() !== null">
          ({{ progressPercent() }}% complete)
        </span>
      </div>

      <app-progress-bar 
        *ngIf="progressPercent() !== null" 
        [percentage]="progressPercent()!" 
      />

      <div class="item-meta">
        <span class="status" [class]="'status-' + item().status">
          {{ item().status }}
        </span>
        <app-time-ago [date]="lastWatchedDate()" />
      </div>

      <div class="item-actions">
        <button (click)="onMarkWatched.emit()" [disabled]="item().status === 'completed'">
          Mark Watched
        </button>
        <button *ngIf="item().type === 'series'" (click)="onMarkCompleted.emit()" [disabled]="item().status === 'completed'">
          Mark Completed
        </button>
      </div>
    </div>
  `,
  styles: [`
    .item-card {
      border: 1px solid light-dark(var(--light-border-color), var(--dark-border-color));
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
      background: light-dark(var(--light-bg-secondary), var(--dark-bg-secondary));
      box-shadow: 0 2px 4px light-dark(var(--light-shadow), var(--dark-shadow));
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .item-header h3 {
      margin: 0;
      font-size: 1.2rem;
    }

    .item-header h3 a {
      text-decoration: none;
      color: light-dark(var(--light-font-color), var(--dark-font-color));
    }

    .item-header h3 a:hover {
      color: var(--accent-primary);
    }

    .item-type {
      background: light-dark(var(--light-bg-tertiary), var(--dark-bg-tertiary));
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      text-transform: capitalize;
    }

    .item-info {
      margin: 0.5rem 0;
      font-size: 0.9rem;
      color: light-dark(var(--light-font-secondary), var(--dark-font-secondary));
    }

    .progress-percent {
      margin-left: 0.5rem;
    }

    .item-meta {
      display: flex;
      gap: 1rem;
      margin: 0.5rem 0;
      font-size: 0.85rem;
    }

    .status {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-weight: 500;
      text-transform: capitalize;
    }

    .status-not-started {
      background: light-dark(#fff3cd, #856404);
      color: light-dark(#856404, #fff3cd);
    }

    .status-in-progress {
      background: light-dark(#d1ecf1, #0c5460);
      color: light-dark(#0c5460, #d1ecf1);
    }

    .status-completed {
      background: light-dark(#d4edda, #155724);
      color: light-dark(#155724, #d4edda);
    }

    .item-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .item-actions button {
      padding: 0.5rem 1rem;
      border: 1px solid light-dark(var(--light-border-color), var(--dark-border-color));
      border-radius: 4px;
      background: light-dark(var(--light-bg-secondary), var(--dark-bg-secondary));
      color: light-dark(var(--light-font-color), var(--dark-font-color));
      cursor: pointer;
      font-size: 0.9rem;
    }

    .item-actions button:hover:not(:disabled) {
      background: light-dark(var(--light-bg-tertiary), var(--dark-bg-tertiary));
    }

    .item-actions button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
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
    const i = this.item();
    if (i.watchHistory && i.watchHistory.length > 0) {
      const sorted = [...i.watchHistory].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return sorted[0].date;
    }
    return i.createdAt;
  });
}

