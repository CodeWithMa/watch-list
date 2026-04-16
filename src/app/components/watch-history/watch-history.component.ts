import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WatchListService, HistoryEntry } from '../../services/watch-list.service';
interface CalendarGroup {
  relativeLabel: string;
  dateLabel: string;
  entries: (HistoryEntry & { relativeTime: string })[];
}

@Component({
  selector: 'app-watch-history',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-[800px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Watch History</h1>

      <div *ngIf="history().length === 0; else hasHistory" class="text-center p-16 bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border">
        <div class="text-5xl mb-4 opacity-30">🗓️</div>
        <p class="text-light-font-secondary dark:text-dark-font-secondary mb-2">No watch history yet.</p>
        <p class="text-sm text-light-font-muted dark:text-dark-font-muted mb-4">Start watching to see your history here!</p>
        <a [routerLink]="['/items']" class="inline-block px-6 py-3 bg-accent-primary text-white no-underline rounded-lg font-medium hover:bg-accent-primary-hover transition-colors">Browse Items</a>
      </div>

      <ng-template #hasHistory>
        <div class="space-y-2">
          <div *ngFor="let group of calendarGroups()" class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border overflow-hidden">
            <div class="flex items-center gap-3 px-5 py-3 bg-light-bg-tertiary dark:bg-dark-bg-tertiary border-b border-light-border dark:border-dark-border">
              <span class="text-sm font-semibold text-light-font dark:text-dark-font">{{ group.relativeLabel }}</span>
              <span class="text-xs text-light-font-muted dark:text-dark-font-muted">{{ group.dateLabel }}</span>
              <span class="ml-auto text-xs bg-accent-primary/10 text-accent-primary px-2 py-0.5 rounded-full font-medium">{{ group.entries.length }}</span>
            </div>

            <div *ngFor="let entry of group.entries; let last = last" class="flex items-center gap-4 px-5 py-3 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors" [ngClass]="{ 'border-b border-light-border-light dark:border-dark-border-light': !last }">
              <span class="text-sm font-mono text-light-font-muted dark:text-dark-font-muted min-w-[60px]">{{ entry.relativeTime }}</span>

              <div class="w-1.5 h-1.5 rounded-full shrink-0"
                   [ngClass]="{
                     'bg-accent-primary': entry.itemType === 'series',
                     'bg-accent-success': entry.itemType === 'movie'
                   }"></div>

              <a [routerLink]="['/items', entry.itemId]" class="text-sm font-medium text-light-font dark:text-dark-font no-underline hover:text-accent-primary transition-colors truncate flex-1">
                {{ entry.itemTitle }}
              </a>

              <span class="text-xs px-2 py-0.5 rounded capitalize bg-light-bg-tertiary dark:bg-dark-bg-tertiary text-light-font-secondary dark:text-dark-font-secondary shrink-0">{{ entry.itemType }}</span>

              <span *ngIf="entry.itemType === 'series'" class="text-xs bg-accent-primary/10 text-accent-primary px-2 py-0.5 rounded font-medium shrink-0">
                S{{ entry.season }}E{{ entry.episode }}
              </span>
            </div>
          </div>
        </div>
      </ng-template>
    </div>
  `
})
export class WatchHistoryComponent implements OnInit {
  history = signal<HistoryEntry[]>([]);

  calendarGroups = computed(() => {
    const entries = this.history();
    const groups: CalendarGroup[] = [];
    const groupMap = new Map<string, (HistoryEntry & { relativeTime: string })[]>();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const entry of entries) {
      const entryDate = new Date(entry.date);
      const entryDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
      const dayKey = entryDay.toISOString();

      if (!groupMap.has(dayKey)) {
        groupMap.set(dayKey, []);
      }

      const hours = entryDate.getHours();
      const minutes = entryDate.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
      const relativeTime = `${displayHours}:${displayMinutes} ${ampm}`;

      const augmentedEntry = { ...entry, relativeTime };
      groupMap.get(dayKey)!.push(augmentedEntry);
    }

    groupMap.forEach((entries, dayKey) => {
      const entryDay = new Date(dayKey);
      let relativeLabel: string;

      const daysDiff = Math.round((today.getTime() - entryDay.getTime()) / 86400000);

      if (daysDiff === 0) {
        relativeLabel = 'Today';
      } else if (daysDiff === 1) {
        relativeLabel = 'Yesterday';
      } else if (daysDiff <= 6) {
        relativeLabel = entryDay.toLocaleDateString('en-US', { weekday: 'long' });
      } else {
        relativeLabel = entryDay.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      }

      const dateLabel = entryDay.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      groups.push({ relativeLabel, dateLabel, entries });
    });

    groups.sort((a, b) => new Date(b.entries[0].date).getTime() - new Date(a.entries[0].date).getTime());

    return groups;
  });

  constructor(private watchListService: WatchListService) {}

  ngOnInit(): void {
    this.history.set(this.watchListService.getAllWatchHistory());
  }
}
