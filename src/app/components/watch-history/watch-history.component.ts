import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WatchListService, HistoryEntry } from '../../services/watch-list.service';
import { DateFormatPipe } from '../../pipes/date-format.pipe';
import { TimeFormatPipe } from '../../pipes/time-format.pipe';

@Component({
  selector: 'app-watch-history',
  imports: [CommonModule, RouterLink, DateFormatPipe, TimeFormatPipe],
  template: `
    <div class="history-container">
      <h1>Watch History</h1>

      <div *ngIf="history().length === 0; else hasHistory" class="empty-state">
        <p>No watch history yet.</p>
        <p>Start watching to see your history here!</p>
        <a [routerLink]="['/items']" class="action-button">Browse Items</a>
      </div>

      <ng-template #hasHistory>
        <div class="timeline">
          <div *ngFor="let entry of history(); let i = index" class="timeline-entry">
            <div class="timeline-date">
              <span class="date">{{ entry.date | dateFormat }}</span>
              <span class="time">{{ entry.date | timeFormat }}</span>
            </div>
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <a [routerLink]="['/items', entry.itemId]" class="item-title">
                {{ entry.itemTitle }}
              </a>
              <span class="item-type">{{ entry.itemType }}</span>
              <span *ngIf="entry.itemType === 'series'" class="episode-info">
                S{{ entry.season }}E{{ entry.episode }}
              </span>
            </div>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .history-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 2rem;
      color: light-dark(var(--light-font-color), var(--dark-font-color));
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      background: light-dark(var(--light-bg-secondary), var(--dark-bg-secondary));
      border-radius: 8px;
    }

    .empty-state p {
      color: light-dark(var(--light-font-secondary), var(--dark-font-secondary));
      margin-bottom: 0.5rem;
    }

    .empty-state .action-button {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.75rem 1.5rem;
      background: var(--accent-primary);
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
    }

    .empty-state .action-button:hover {
      background: var(--accent-primary-hover);
    }

    .timeline {
      position: relative;
    }

    .timeline-entry {
      display: flex;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      position: relative;
    }

    .timeline-entry:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 100px;
      top: 24px;
      bottom: -1.5rem;
      width: 2px;
      background: light-dark(var(--light-border-color), var(--dark-border-color));
    }

    .timeline-date {
      min-width: 100px;
      text-align: right;
      padding-right: 1rem;
    }

    .date {
      display: block;
      font-weight: 500;
      color: light-dark(var(--light-font-color), var(--dark-font-color));
    }

    .time {
      display: block;
      font-size: 0.85rem;
      color: light-dark(var(--light-font-muted), var(--dark-font-muted));
    }

    .timeline-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--accent-primary);
      margin: 4px 1rem 0;
      flex-shrink: 0;
      position: relative;
      z-index: 1;
    }

    .timeline-content {
      flex: 1;
      background: light-dark(var(--light-bg-secondary), var(--dark-bg-secondary));
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid light-dark(var(--light-border-color), var(--dark-border-color));
    }

    .item-title {
      font-weight: 500;
      color: light-dark(var(--light-font-color), var(--dark-font-color));
      text-decoration: none;
      margin-right: 0.5rem;
    }

    .item-title:hover {
      color: var(--accent-primary);
    }

    .item-type {
      font-size: 0.85rem;
      color: light-dark(var(--light-font-muted), var(--dark-font-muted));
      text-transform: capitalize;
      margin-right: 0.5rem;
    }

    .episode-info {
      font-size: 0.85rem;
      background: light-dark(var(--light-bg-tertiary), var(--dark-bg-tertiary));
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-weight: 500;
    }

    @media (max-width: 600px) {
      .timeline-date {
        min-width: 70px;
        font-size: 0.85rem;
      }

      .timeline-dot {
        margin: 4px 0.5rem 0;
      }

      .timeline-entry:not(:last-child)::before {
        left: 75px;
      }
    }
  `]
})
export class WatchHistoryComponent implements OnInit {
  history = signal<HistoryEntry[]>([]);

  constructor(private watchListService: WatchListService) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.history.set(this.watchListService.getAllWatchHistory());
  }
}
