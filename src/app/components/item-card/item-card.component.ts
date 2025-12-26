import { Component, input, output } from '@angular/core';
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
        <app-time-ago [date]="item().lastWatchedAt" />
      </div>

      <div class="item-actions">
        <button (click)="onMarkWatched.emit()" [disabled]="item().status === 'completed'">
          Mark Watched
        </button>
        <button (click)="onMarkCompleted.emit()" [disabled]="item().status === 'completed'">
          Mark Completed
        </button>
      </div>
    </div>
  `,
  styles: [`
    .item-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
      color: #333;
    }

    .item-header h3 a:hover {
      color: #007bff;
    }

    .item-type {
      background: #f0f0f0;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      text-transform: capitalize;
    }

    .item-info {
      margin: 0.5rem 0;
      font-size: 0.9rem;
      color: #666;
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
      background: #fff3cd;
      color: #856404;
    }

    .status-in-progress {
      background: #d1ecf1;
      color: #0c5460;
    }

    .status-completed {
      background: #d4edda;
      color: #155724;
    }

    .item-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .item-actions button {
      padding: 0.5rem 1rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .item-actions button:hover:not(:disabled) {
      background: #f8f9fa;
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

  progressPercent(): number | null {
    return this.watchListService.calculateProgress(this.item());
  }
}

