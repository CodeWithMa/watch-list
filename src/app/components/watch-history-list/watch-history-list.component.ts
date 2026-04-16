import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WatchListService, HistoryEntry } from '../../services/watch-list.service';
import { DateFormatPipe } from '../../pipes/date-format.pipe';
import { TimeFormatPipe } from '../../pipes/time-format.pipe';

@Component({
  selector: 'app-watch-history-list',
  imports: [CommonModule, RouterLink, DateFormatPipe, TimeFormatPipe],
  template: `
    <div class="max-w-[900px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Watch History</h1>

      <div *ngIf="history().length === 0; else hasHistory" class="text-center p-16 bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border">
        <div class="text-5xl mb-4 opacity-30">📋</div>
        <p class="text-light-font-secondary dark:text-dark-font-secondary mb-2">No watch history yet.</p>
        <p class="text-sm text-light-font-muted dark:text-dark-font-muted mb-4">Start watching to see your history here!</p>
        <a [routerLink]="['/items']" class="inline-block px-6 py-3 bg-accent-primary text-white no-underline rounded-lg font-medium hover:bg-accent-primary-hover transition-colors">Browse Items</a>
      </div>

      <ng-template #hasHistory>
        <div class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border overflow-hidden">
          <div class="grid grid-cols-[140px_80px_1fr_100px_1fr] gap-2 px-4 py-2 bg-light-bg-tertiary dark:bg-dark-bg-tertiary border-b border-light-border dark:border-dark-border text-xs font-semibold text-light-font-muted dark:text-dark-font-muted uppercase tracking-wider max-sm:hidden">
            <span>Date</span>
            <span>Time</span>
            <span>Title</span>
            <span>Type</span>
            <span>Episode</span>
          </div>

          <div *ngFor="let entry of history(); let i = index" class="grid grid-cols-[140px_80px_1fr_100px_1fr] gap-2 px-4 py-3 items-center border-b border-light-border-light dark:border-dark-border-light last:border-b-0 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors max-sm:hidden">
            <span class="text-sm text-light-font dark:text-dark-font">{{ entry.date | dateFormat }}</span>
            <span class="text-sm text-light-font-muted dark:text-dark-font-muted">{{ entry.date | timeFormat }}</span>
            <a [routerLink]="['/items', entry.itemId]" class="text-sm font-medium text-light-font dark:text-dark-font no-underline hover:text-accent-primary transition-colors truncate">{{ entry.itemTitle }}</a>
            <span class="text-xs px-2 py-0.5 rounded capitalize bg-light-bg-tertiary dark:bg-dark-bg-tertiary text-light-font-secondary dark:text-dark-font-secondary w-fit">{{ entry.itemType }}</span>
            <span *ngIf="entry.itemType === 'series'" class="text-sm text-light-font-secondary dark:text-dark-font-secondary">S{{ entry.season }}E{{ entry.episode }}</span>
            <span *ngIf="entry.itemType !== 'series'" class="text-sm text-light-font-muted dark:text-dark-font-muted">—</span>
          </div>

          <div *ngFor="let entry of history()" class="sm:hidden px-4 py-3 border-b border-light-border-light dark:border-dark-border-light last:border-b-0">
            <div class="flex items-center justify-between mb-1">
              <a [routerLink]="['/items', entry.itemId]" class="text-sm font-medium text-light-font dark:text-dark-font no-underline hover:text-accent-primary truncate mr-2">{{ entry.itemTitle }}</a>
              <span class="text-xs px-2 py-0.5 rounded capitalize bg-light-bg-tertiary dark:bg-dark-bg-tertiary text-light-font-secondary dark:text-dark-font-secondary shrink-0">{{ entry.itemType }}</span>
            </div>
            <div class="flex items-center gap-3 text-xs text-light-font-muted dark:text-dark-font-muted">
              <span>{{ entry.date | dateFormat }}</span>
              <span>{{ entry.date | timeFormat }}</span>
              <span *ngIf="entry.itemType === 'series'">S{{ entry.season }}E{{ entry.episode }}</span>
            </div>
          </div>
        </div>
      </ng-template>
    </div>
  `
})
export class WatchHistoryListComponent implements OnInit {
  history = signal<HistoryEntry[]>([]);

  constructor(private watchListService: WatchListService) {}

  ngOnInit(): void {
    this.history.set(this.watchListService.getAllWatchHistory());
  }
}
