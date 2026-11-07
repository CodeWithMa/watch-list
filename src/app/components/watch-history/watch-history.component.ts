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
    <div class="reading-measure">
      <h1 class="page-title mb-6">Watch history</h1>

      @if (history().length === 0) {
        <div class="card p-6 sm:p-8 text-center">
          <h2 class="section-title mb-2">No watch history yet</h2>
          <p class="mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">
            Episodes and movies you mark as watched appear here, grouped by day.
          </p>
          <a routerLink="/" class="btn btn-primary">See what to watch next</a>
        </div>
      } @else {
        <!-- One list; days are slim dividers that stay pinned while their entries scroll. -->
        <div class="card overflow-clip">
          @for (group of calendarGroups(); track group.dayKey) {
            <section
              [attr.aria-labelledby]="'day-' + $index"
              class="last:[&_li:last-child]:border-b-0"
            >
              <h2
                [id]="'day-' + $index"
                class="sticky top-14 md:top-16 z-10 flex items-baseline justify-between gap-3 m-0 px-4 py-1.5 text-meta font-semibold bg-light-bg-tertiary dark:bg-dark-bg-tertiary text-light-font dark:text-dark-font border-b border-light-border-light dark:border-dark-border-light"
              >
                {{ group.label }}
                @if (group.entries.length > 1) {
                  <span class="meta font-normal">{{ group.entries.length }} watched</span>
                }
              </h2>
              <ol class="list-none m-0 p-0">
                @for (entry of group.entries; track entry.itemId + '-' + entry.date) {
                  <li
                    class="flex items-center gap-3 px-4 py-2.5 border-b border-light-border-light dark:border-dark-border-light"
                  >
                    <span class="meta shrink-0 w-16 tabular-nums">{{ entry.relativeTime }}</span>

                    @if (entry.isDeleted) {
                      <span class="flex-1 min-w-0 truncate text-sm font-medium">
                        {{ entry.itemTitle }}
                        <span class="font-normal text-light-font-muted dark:text-dark-font-muted"
                          >(deleted)</span
                        >
                      </span>
                    } @else {
                      <a
                        [routerLink]="['/items', entry.itemId]"
                        class="flex-1 min-w-0 truncate text-sm font-medium no-underline text-light-font dark:text-dark-font hover:text-accent-text"
                      >
                        {{ entry.itemTitle }}
                      </a>
                    }

                    <span class="meta max-sm:hidden shrink-0">{{
                      typeLabels[entry.itemType]
                    }}</span>
                    @if (entry.itemType !== 'movie') {
                      <span class="tag tag-accent shrink-0">{{ formatEpisode(entry) }}</span>
                    }
                  </li>
                }
              </ol>
            </section>
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
