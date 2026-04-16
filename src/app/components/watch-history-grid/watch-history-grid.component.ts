import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WatchListService, HistoryEntry } from '../../services/watch-list.service';
import { TimeFormatPipe } from '../../pipes/time-format.pipe';

@Component({
  selector: 'app-watch-history-grid',
  imports: [CommonModule, RouterLink, TimeFormatPipe],
  template: `
    <div class="max-w-[900px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Watch History</h1>

      <div *ngIf="history().length === 0; else hasHistory" class="text-center p-16 bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border">
        <div class="text-5xl mb-4 opacity-30">📺</div>
        <p class="text-light-font-secondary dark:text-dark-font-secondary mb-2">No watch history yet.</p>
        <p class="text-sm text-light-font-muted dark:text-dark-font-muted mb-4">Start watching to see your history here!</p>
        <a [routerLink]="['/items']" class="inline-block px-6 py-3 bg-accent-primary text-white no-underline rounded-lg font-medium hover:bg-accent-primary-hover transition-colors">Browse Items</a>
      </div>

      <ng-template #hasHistory>
        <div *ngFor="let group of groupedHistory()">
          <div class="flex items-center gap-3 mb-4 mt-8 first:mt-0">
            <h2 class="text-sm font-semibold text-light-font-muted dark:text-dark-font-muted uppercase tracking-wider m-0">{{ group.dateLabel }}</h2>
            <div class="flex-1 h-px bg-light-border dark:bg-dark-border"></div>
            <span class="text-xs text-light-font-muted dark:text-dark-font-muted">{{ group.entries.length }} {{ group.entries.length === 1 ? 'item' : 'items' }}</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div *ngFor="let entry of group.entries" class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-4 hover:shadow-light dark:hover:shadow-dark transition-shadow group/card">
              <div class="flex items-start justify-between mb-3">
                <span class="text-xs px-2 py-0.5 rounded font-medium capitalize bg-light-bg-tertiary dark:bg-dark-bg-tertiary text-light-font-secondary dark:text-dark-font-secondary">{{ entry.itemType }}</span>
                <span class="text-xs text-light-font-muted dark:text-dark-font-muted">{{ entry.date | timeFormat }}</span>
              </div>

              <a [routerLink]="['/items', entry.itemId]" class="block font-medium text-light-font dark:text-dark-font no-underline hover:text-accent-primary transition-colors mb-2 line-clamp-2">
                {{ entry.itemTitle }}
              </a>

              <div *ngIf="entry.itemType === 'series'" class="text-xs bg-accent-primary/10 text-accent-primary px-2 py-1 rounded inline-block font-medium">
                S{{ entry.season }}E{{ entry.episode }}
              </div>
            </div>
          </div>
        </div>
      </ng-template>
    </div>
  `
})
export class WatchHistoryGridComponent implements OnInit {
  history = signal<HistoryEntry[]>([]);

  groupedHistory = computed(() => {
    const entries = this.history();
    const groups: { dateLabel: string; entries: HistoryEntry[] }[] = [];
    const groupMap = new Map<string, HistoryEntry[]>();

    for (const entry of entries) {
      const dateStr = new Date(entry.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      if (!groupMap.has(dateStr)) {
        groupMap.set(dateStr, []);
      }
      groupMap.get(dateStr)!.push(entry);
    }

    groupMap.forEach((entries, dateLabel) => {
      groups.push({ dateLabel, entries });
    });

    return groups;
  });

  constructor(private watchListService: WatchListService) {}

  ngOnInit(): void {
    this.history.set(this.watchListService.getAllWatchHistory());
  }
}
