import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WatchListService } from '../../services/watch-list.service';
import { groupHistoryEntries } from '../../utils/watch-history.utils';

@Component({
  selector: 'app-watch-history',
  imports: [RouterLink],
  template: `
    <div class="max-w-[800px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Watch History</h1>

      @if (history().length === 0) {
        <div class="text-center p-16 bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border">
          <div class="text-5xl mb-4 opacity-30">🗓️</div>
          <p class="text-light-font-secondary dark:text-dark-font-secondary mb-2">No watch history yet.</p>
          <p class="text-sm text-light-font-muted dark:text-dark-font-muted mb-4">Start watching to see your history here!</p>
          <a [routerLink]="['/items']" class="inline-block px-6 py-3 bg-accent-primary text-white no-underline rounded-lg font-medium hover:bg-accent-primary-hover transition-colors">Browse Items</a>
        </div>
      } @else {
        <div class="space-y-2">
          @for (group of calendarGroups(); track group.dateLabel) {
            <div class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border overflow-hidden">
              <div class="flex items-center gap-3 px-5 py-3 bg-light-bg-tertiary dark:bg-dark-bg-tertiary border-b border-light-border dark:border-dark-border">
                <span class="text-sm font-semibold text-light-font dark:text-dark-font">{{ group.relativeLabel }}</span>
                <span class="text-xs text-light-font-muted dark:text-dark-font-muted">{{ group.dateLabel }}</span>
                <span class="ml-auto text-xs bg-accent-primary/10 text-accent-primary px-2 py-0.5 rounded-full font-medium">{{ group.entries.length }}</span>
              </div>

              @for (entry of group.entries; track entry.itemId + '-' + entry.date) {
                <div class="flex items-center gap-4 px-5 py-3 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors border-b border-light-border-light dark:border-dark-border-light last:border-b-0">
                  <span class="text-sm font-mono text-light-font-muted dark:text-dark-font-muted min-w-[60px]">{{ entry.relativeTime }}</span>

                  <div class="w-1.5 h-1.5 rounded-full shrink-0"
                       [class.bg-accent-primary]="entry.itemType === 'series'"
                       [class.bg-accent-success]="entry.itemType === 'movie'"></div>

                  @if (entry.isDeleted) {
                    <span class="text-sm font-medium text-light-font dark:text-dark-font no-underline truncate flex-1">
                      {{ entry.itemTitle }} <span class="text-light-font-muted dark:text-dark-font-muted">(deleted)</span>
                    </span>
                  } @else {
                    <a [routerLink]="['/items', entry.itemId]" class="text-sm font-medium text-light-font dark:text-dark-font no-underline hover:text-accent-primary transition-colors truncate flex-1">
                      {{ entry.itemTitle }}
                    </a>
                  }

                  <span class="text-xs px-2 py-0.5 rounded capitalize bg-light-bg-tertiary dark:bg-dark-bg-tertiary text-light-font-secondary dark:text-dark-font-secondary shrink-0">{{ entry.itemType }}</span>

                  @if (entry.itemType === 'series') {
                    <span class="text-xs bg-accent-primary/10 text-accent-primary px-2 py-0.5 rounded font-medium shrink-0">
                      S{{ entry.season }}E{{ entry.episode }}
                    </span>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `
})
export class WatchHistoryComponent {
  private watchListService = inject(WatchListService);

  history = this.watchListService.history;

  calendarGroups = computed(() => groupHistoryEntries(this.history()));
}
