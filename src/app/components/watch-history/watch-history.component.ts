import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WatchListService } from '../../services/watch-list.service';
import { groupHistoryEntries } from '../../utils/watch-history.utils';
import { ITEM_TYPE_LABELS } from '../../domain/item.constants';
import { formatEpisode } from '../../utils/progress.utils';

@Component({
  selector: 'app-watch-history',
  imports: [RouterLink],
  template: `
    <div>
      <h1 class="page-title mb-6">Watch history</h1>

      @if (history().length === 0) {
        <div class="card p-6 sm:p-8 text-center">
          <p class="text-light-font-secondary dark:text-dark-font-secondary mb-2">
            No watch history yet.
          </p>
          <p class="text-sm text-light-font-muted dark:text-dark-font-muted mb-4">
            Start watching to see your history here!
          </p>
          <a [routerLink]="['/items']" class="btn btn-primary">Browse Items</a>
        </div>
      } @else {
        <div class="space-y-3">
          @for (group of calendarGroups(); track group.dateLabel) {
            <div
              class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border overflow-hidden"
            >
              <div
                class="flex items-center gap-3 px-4 py-2 bg-light-bg-tertiary dark:bg-dark-bg-tertiary border-b border-light-border dark:border-dark-border"
              >
                <span class="text-sm font-semibold text-light-font dark:text-dark-font">{{
                  group.relativeLabel
                }}</span>
                <span class="text-xs text-light-font-muted dark:text-dark-font-muted">{{
                  group.dateLabel
                }}</span>
                <span
                  class="ml-auto text-xs bg-accent-primary/10 text-accent-text px-2 py-0.5 rounded-full font-medium"
                  >{{ group.entries.length }}</span
                >
              </div>

              @for (entry of group.entries; track entry.itemId + '-' + entry.date) {
                <div
                  class="flex items-center gap-3 px-4 py-2 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors border-b border-light-border-light dark:border-dark-border-light last:border-b-0"
                >
                  <span
                    class="text-xs shrink-0 text-light-font-secondary dark:text-dark-font-secondary min-w-14"
                    >{{ entry.relativeTime }}</span
                  >

                  @if (entry.isDeleted) {
                    <span
                      class="text-sm font-medium text-light-font dark:text-dark-font no-underline truncate flex-1"
                    >
                      {{ entry.itemTitle }}
                      <span class="text-light-font-muted dark:text-dark-font-muted">(deleted)</span>
                    </span>
                  } @else {
                    <a
                      [routerLink]="['/items', entry.itemId]"
                      class="text-sm font-medium text-light-font dark:text-dark-font no-underline hover:text-accent-text transition-colors truncate flex-1"
                    >
                      {{ entry.itemTitle }}
                    </a>
                  }

                  <span
                    class="max-sm:hidden text-xs shrink-0 text-light-font-secondary dark:text-dark-font-secondary"
                    >{{ typeLabels[entry.itemType] }}</span
                  >

                  @if (entry.itemType !== 'movie') {
                    <span
                      class="text-xs bg-accent-primary/10 text-accent-text px-2 py-0.5 rounded font-medium shrink-0"
                    >
                      {{ formatEpisode(entry) }}
                    </span>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class WatchHistoryComponent {
  private watchListService = inject(WatchListService);

  protected readonly typeLabels = ITEM_TYPE_LABELS;
  protected readonly formatEpisode = formatEpisode;

  history = this.watchListService.history;

  calendarGroups = computed(() => groupHistoryEntries(this.history()));
}
