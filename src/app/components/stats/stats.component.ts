import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatsService } from '../../services/stats.service';
import { ITEM_TYPE_LABELS } from '../../domain/item.constants';
import { ItemStatus } from '../../models/item.model';
import { StatsHeatmapComponent } from './stats-heatmap/stats-heatmap.component';
import { StatsDailyActivityComponent } from './stats-daily-activity/stats-daily-activity.component';

const PATTERN_SAMPLE_SIZE = 20;

const BREAKDOWN_ROWS: readonly { label: string; status: ItemStatus }[] = [
  { label: 'In progress', status: 'in-progress' },
  { label: 'Paused', status: 'paused' },
  { label: 'Completed', status: 'completed' },
  { label: 'Dropped', status: 'dropped' },
  { label: 'Not started', status: 'not-started' },
];

@Component({
  selector: 'app-stats',
  imports: [RouterLink, StatsHeatmapComponent, StatsDailyActivityComponent],
  template: `
    <div>
      <h1 class="page-title mb-6">Stats</h1>

      @if (totalItems() === 0 && history().length === 0) {
        <div class="card p-6 sm:p-8 text-center">
          <p class="text-light-font-secondary dark:text-dark-font-secondary mt-0 mb-2">
            No data to show yet.
          </p>
          <p class="text-sm text-light-font-secondary dark:text-dark-font-secondary mt-0 mb-4">
            Add titles and start watching to see your stats.
          </p>
          <a [routerLink]="['/items/add']" class="btn btn-primary">Add title</a>
        </div>
      } @else {
        <div class="space-y-6 sm:space-y-8">
          <section>
            <h2 class="section-title mb-3">Overview</h2>
            <dl
              class="card overflow-hidden m-0 grid grid-cols-3 lg:grid-cols-6 gap-px bg-light-border dark:bg-dark-border"
            >
              @for (metric of overview(); track metric.label) {
                <div
                  class="p-3 sm:p-4 text-center flex flex-col-reverse justify-end bg-light-bg-secondary dark:bg-dark-bg-secondary"
                >
                  <dt class="meta mt-1">
                    {{ metric.label }}
                  </dt>
                  <dd class="m-0 text-2xl font-bold">{{ metric.value }}</dd>
                </div>
              }
            </dl>
          </section>

          <section>
            <h2 class="section-title mb-3">Activity</h2>
            <div class="card p-4 sm:p-6">
              <app-stats-heatmap [historyEntries]="history()" />
            </div>
          </section>

          <section>
            <h2 class="section-title mb-3">Streaks</h2>
            <dl
              class="card overflow-hidden m-0 grid grid-cols-3 gap-px bg-light-border dark:bg-dark-border"
            >
              @for (metric of streaks(); track metric.label) {
                <div
                  class="p-3 sm:p-4 text-center flex flex-col-reverse justify-end bg-light-bg-secondary dark:bg-dark-bg-secondary"
                >
                  <dt class="meta mt-1">
                    {{ metric.label }}
                  </dt>
                  <dd class="m-0 text-2xl font-bold">{{ metric.value }}</dd>
                </div>
              }
            </dl>
          </section>

          @if (mostWatchedItems().length > 0) {
            <section>
              <h2 class="section-title mb-3">Most watched</h2>
              <div class="card overflow-hidden">
                @for (item of mostWatchedItems(); track item.id; let i = $index) {
                  <div
                    class="flex items-center gap-3 px-4 py-2 border-b border-light-border-light dark:border-dark-border-light last:border-b-0 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors"
                  >
                    <span
                      class="text-sm text-light-font-secondary dark:text-dark-font-secondary w-5 text-right shrink-0"
                      >{{ i + 1 }}</span
                    >
                    <a
                      [routerLink]="['/items', item.id]"
                      class="flex-1 min-w-0 truncate no-underline text-sm font-medium text-light-font dark:text-dark-font hover:text-accent-text transition-colors"
                    >
                      {{ item.title }}
                    </a>
                    <span
                      class="max-sm:hidden text-xs shrink-0 text-light-font-secondary dark:text-dark-font-secondary"
                      >{{ typeLabels[item.type] }}</span
                    >
                    <span class="text-sm font-medium shrink-0">{{
                      entryCount(item.watchHistory.length)
                    }}</span>
                  </div>
                }
              </div>
            </section>
          }

          <details [open]="hasEnoughHistory()">
            <summary class="section-title min-h-11 flex items-center cursor-pointer">
              More insights
            </summary>
            <div class="space-y-6 sm:space-y-8 mt-3">
              @if (!hasEnoughHistory()) {
                <p class="m-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
                  Based on {{ entryCount(history().length) }}. Patterns become meaningful after
                  {{ patternSampleSize }} or more.
                </p>
              }
              <section>
                <h3 class="text-base font-semibold mt-0 mb-3">Daily activity</h3>
                <div class="card p-4 sm:p-6">
                  <app-stats-daily-activity [historyEntries]="history()" />
                </div>
              </section>

              <section>
                <h3 class="text-base font-semibold mt-0 mb-3">Breakdown</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  @for (group of breakdown(); track group.title) {
                    <div class="card p-4">
                      <h4
                        class="text-sm font-semibold mt-0 mb-3 text-light-font-secondary dark:text-dark-font-secondary"
                      >
                        {{ group.title }}
                      </h4>
                      <div class="space-y-2">
                        @for (row of group.rows; track row.label) {
                          <div class="flex justify-between text-sm">
                            <span class="text-light-font-secondary dark:text-dark-font-secondary">{{
                              row.label
                            }}</span>
                            <span class="font-medium">{{ row.value }}</span>
                          </div>
                        }
                        <div
                          class="border-t border-light-border-light dark:border-dark-border-light pt-2 mt-2 flex justify-between gap-4 text-sm"
                        >
                          <span class="text-light-font-secondary dark:text-dark-font-secondary"
                            >{{ group.summaryLabel }}
                            @if (group.summaryHint; as hint) {
                              <span class="block text-xs">{{ hint }}</span>
                            }
                          </span>
                          <span class="font-medium shrink-0">{{ group.summary }}</span>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </section>

              <section>
                <h3 class="text-base font-semibold mt-0 mb-3">Watch patterns</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="card p-4">
                    <h4
                      class="text-sm font-semibold mt-0 mb-2 text-light-font-secondary dark:text-dark-font-secondary"
                    >
                      Most active day
                    </h4>
                    <div class="text-2xl font-bold mb-1">{{ mostActiveDay() }}</div>
                    <div class="text-xs text-light-font-secondary dark:text-dark-font-secondary">
                      {{ entryCount(mostActiveDayCount()) }}
                    </div>
                  </div>
                  <div class="card p-4">
                    <h4
                      class="text-sm font-semibold mt-0 mb-2 text-light-font-secondary dark:text-dark-font-secondary"
                    >
                      Most active time
                    </h4>
                    <div class="text-2xl font-bold mb-1">{{ mostActiveTimeOfDay() }}</div>
                    <div class="text-xs text-light-font-secondary dark:text-dark-font-secondary">
                      {{ entryCount(mostActiveTimeOfDayCount()) }}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </details>
        </div>
      }
    </div>
  `,
})
export class StatsComponent {
  private statsService = inject(StatsService);

  items = this.statsService.items;
  history = this.statsService.history;

  totalItems = this.statsService.totalItems;
  inProgressCount = this.statsService.inProgressCount;
  completedCount = this.statsService.completedCount;
  droppedCount = this.statsService.droppedCount;
  totalEpisodesWatched = this.statsService.totalEpisodesWatched;
  totalMoviesWatched = this.statsService.totalMoviesWatched;
  seriesCountByStatus = this.statsService.seriesCountByStatus;
  moviesCountByStatus = this.statsService.moviesCountByStatus;
  mostWatchedItems = this.statsService.mostWatchedItems;
  avgEpisodesPerActiveSeries = this.statsService.avgEpisodesPerActiveSeries;
  avgTimeToComplete = this.statsService.avgTimeToComplete;
  totalDaysWatched = this.statsService.totalDaysWatched;
  currentStreak = this.statsService.currentStreak;
  longestStreak = this.statsService.longestStreak;
  mostActiveDay = this.statsService.mostActiveDay;
  mostActiveDayCount = this.statsService.mostActiveDayCount;
  mostActiveTimeOfDay = this.statsService.mostActiveTimeOfDay;
  mostActiveTimeOfDayCount = this.statsService.mostActiveTimeOfDayCount;

  protected readonly typeLabels = ITEM_TYPE_LABELS;
  protected readonly patternSampleSize = PATTERN_SAMPLE_SIZE;
  protected readonly hasEnoughHistory = computed(
    () => this.history().length >= PATTERN_SAMPLE_SIZE,
  );

  protected readonly overview = computed(() => [
    { label: 'Episodes watched', value: this.totalEpisodesWatched() },
    { label: 'Movies watched', value: this.totalMoviesWatched() },
    { label: 'Watching now', value: this.inProgressCount() },
    { label: 'Completed', value: this.completedCount() },
    { label: 'Dropped', value: this.droppedCount() },
    { label: 'Titles in library', value: this.totalItems() },
  ]);

  protected readonly streaks = computed(() => [
    { label: 'Current streak (days)', value: this.currentStreak() },
    { label: 'Longest streak (days)', value: this.longestStreak() },
    { label: 'Total days watched', value: this.totalDaysWatched() },
  ]);

  protected readonly breakdown = computed(() => [
    {
      title: 'Series',
      rows: BREAKDOWN_ROWS.map(({ label, status }) => ({
        label,
        value: this.seriesCountByStatus()[status],
      })),
      summaryLabel: 'Avg. episodes watched per series in progress',
      summary: this.avgEpisodesPerActiveSeries(),
      summaryHint: null,
    },
    {
      title: 'Movies',
      rows: BREAKDOWN_ROWS.map(({ label, status }) => ({
        label,
        value: this.moviesCountByStatus()[status],
      })),
      summaryLabel: 'Avg. time from added to watched',
      summary: this.avgTimeToComplete() ?? '—',
      summaryHint: this.avgTimeToComplete() ? null : 'No completed movies yet',
    },
  ]);

  protected entryCount(count: number) {
    return `${count} ${count === 1 ? 'entry' : 'entries'}`;
  }
}
