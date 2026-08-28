import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatsService } from '../../services/stats.service';
import { StatsHeatmapComponent } from './stats-heatmap/stats-heatmap.component';

@Component({
  selector: 'app-stats',
  imports: [RouterLink, StatsHeatmapComponent],
  template: `
    <div>
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Stats</h1>

      @if (totalItems() === 0 && history().length === 0) {
        <div
          class="text-center p-16 bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border"
        >
          <div class="text-5xl mb-4 opacity-30">📊</div>
          <p class="text-light-font-secondary dark:text-dark-font-secondary mb-2">
            No data to show yet.
          </p>
          <p class="text-sm text-light-font-muted dark:text-dark-font-muted mb-4">
            Add items and start watching to see your stats!
          </p>
          <a
            [routerLink]="['/items']"
            class="inline-block px-6 py-3 bg-accent-primary text-white no-underline rounded-lg font-medium hover:bg-accent-primary-hover transition-colors"
            >Browse Items</a
          >
        </div>
      } @else {
        <div class="space-y-8">
          <section>
            <h2 class="text-lg font-semibold mb-4 text-light-font dark:text-dark-font">Overview</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-4 text-center"
              >
                <div class="text-2xl font-bold text-accent-primary">{{ totalItems() }}</div>
                <div class="text-xs text-light-font-muted dark:text-dark-font-muted mt-1">
                  Total Items
                </div>
              </div>
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-4 text-center"
              >
                <div class="text-2xl font-bold text-accent-info">{{ inProgressCount() }}</div>
                <div class="text-xs text-light-font-muted dark:text-dark-font-muted mt-1">
                  Watching
                </div>
              </div>
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-4 text-center"
              >
                <div class="text-2xl font-bold text-accent-success">{{ completedCount() }}</div>
                <div class="text-xs text-light-font-muted dark:text-dark-font-muted mt-1">
                  Completed
                </div>
              </div>
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-4 text-center"
              >
                <div class="text-2xl font-bold text-accent-danger">{{ droppedCount() }}</div>
                <div class="text-xs text-light-font-muted dark:text-dark-font-muted mt-1">
                  Dropped
                </div>
              </div>
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-4 text-center"
              >
                <div class="text-2xl font-bold text-accent-warning">
                  {{ totalEpisodesWatched() }}
                </div>
                <div class="text-xs text-light-font-muted dark:text-dark-font-muted mt-1">
                  Episodes
                </div>
              </div>
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-4 text-center"
              >
                <div class="text-2xl font-bold text-light-font dark:text-dark-font">
                  {{ history().length }}
                </div>
                <div class="text-xs text-light-font-muted dark:text-dark-font-muted mt-1">
                  Watch Entries
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-4 text-light-font dark:text-dark-font">Activity</h2>
            <div
              class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-6"
            >
              <app-stats-heatmap [historyEntries]="history()" />
            </div>
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-4 text-light-font dark:text-dark-font">Streaks</h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-4 text-center"
              >
                <div class="text-2xl font-bold text-accent-warning">{{ currentStreak() }}</div>
                <div class="text-xs text-light-font-muted dark:text-dark-font-muted mt-1">
                  Current Streak (days)
                </div>
              </div>
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-4 text-center"
              >
                <div class="text-2xl font-bold text-accent-primary">{{ longestStreak() }}</div>
                <div class="text-xs text-light-font-muted dark:text-dark-font-muted mt-1">
                  Longest Streak (days)
                </div>
              </div>
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-4 text-center"
              >
                <div class="text-2xl font-bold text-accent-success">{{ totalDaysWatched() }}</div>
                <div class="text-xs text-light-font-muted dark:text-dark-font-muted mt-1">
                  Total Days Watched
                </div>
              </div>
            </div>
          </section>

          @if (mostWatchedItems().length > 0) {
            <section>
              <h2 class="text-lg font-semibold mb-4 text-light-font dark:text-dark-font">
                Most Watched
              </h2>
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border overflow-hidden"
              >
                @for (item of mostWatchedItems(); track item.id; let i = $index) {
                  <div
                    class="flex items-center gap-4 px-5 py-3 border-b border-light-border-light dark:border-dark-border-light last:border-b-0 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors"
                  >
                    <span
                      class="text-sm font-mono text-light-font-muted dark:text-dark-font-muted w-6 text-right"
                      >{{ i + 1 }}</span
                    >
                    <div
                      class="w-1.5 h-1.5 rounded-full shrink-0"
                      [class.bg-accent-primary]="item.type === 'series'"
                      [class.bg-accent-success]="item.type === 'movie'"
                      [class.bg-accent-info]="item.type === 'ova'"
                      [class.bg-accent-warning]="item.type === 'ona'"
                    ></div>
                    <a
                      [routerLink]="['/items', item.id]"
                      class="flex-1 truncate no-underline text-sm font-medium text-light-font dark:text-dark-font hover:text-accent-primary transition-colors"
                    >
                      {{ item.title }}
                    </a>
                    <span
                      class="text-xs px-2 py-0.5 rounded capitalize bg-light-bg-tertiary dark:bg-dark-bg-tertiary text-light-font-secondary dark:text-dark-font-secondary shrink-0"
                      >{{ item.type }}</span
                    >
                    <span
                      class="text-sm font-mono font-medium text-light-font dark:text-dark-font shrink-0"
                      >{{ item.watchHistory.length }}</span
                    >
                    <span class="text-xs text-light-font-muted dark:text-dark-font-muted shrink-0"
                      >entries</span
                    >
                  </div>
                }
              </div>
            </section>
          }

          <section>
            <h2 class="text-lg font-semibold mb-4 text-light-font dark:text-dark-font">
              Breakdown
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-5"
              >
                <h3
                  class="text-sm font-semibold mb-3 text-light-font-secondary dark:text-dark-font-secondary"
                >
                  Series
                </h3>
                <div class="space-y-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">In Progress</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      seriesCountByStatus()['in-progress']
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Paused</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      seriesCountByStatus()['paused']
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Completed</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      seriesCountByStatus()['completed']
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Dropped</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      seriesCountByStatus()['dropped']
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Not Started</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      seriesCountByStatus()['not-started']
                    }}</span>
                  </div>
                  <div
                    class="border-t border-light-border-light dark:border-dark-border-light pt-2 mt-2 flex justify-between text-sm"
                  >
                    <span class="text-light-font-muted dark:text-dark-font-muted"
                      >Avg. Episodes / Active</span
                    >
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      avgEpisodesPerActiveSeries()
                    }}</span>
                  </div>
                </div>
              </div>
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-5"
              >
                <h3
                  class="text-sm font-semibold mb-3 text-light-font-secondary dark:text-dark-font-secondary"
                >
                  Movies
                </h3>
                <div class="space-y-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">In Progress</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      moviesCountByStatus()['in-progress']
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Paused</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      moviesCountByStatus()['paused']
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Completed</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      moviesCountByStatus()['completed']
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Dropped</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      moviesCountByStatus()['dropped']
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Not Started</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      moviesCountByStatus()['not-started']
                    }}</span>
                  </div>
                  <div
                    class="border-t border-light-border-light dark:border-dark-border-light pt-2 mt-2 flex justify-between text-sm"
                  >
                    <span class="text-light-font-muted dark:text-dark-font-muted"
                      >Avg. Time to Complete</span
                    >
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      avgTimeToComplete()
                    }}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-4 text-light-font dark:text-dark-font">
              Watch Patterns
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-5"
              >
                <h3
                  class="text-sm font-semibold mb-3 text-light-font-secondary dark:text-dark-font-secondary"
                >
                  Most Active Day
                </h3>
                <div class="text-2xl font-bold text-accent-primary mb-1">{{ mostActiveDay() }}</div>
                <div class="text-xs text-light-font-muted dark:text-dark-font-muted">
                  {{ mostActiveDayCount() }} entries
                </div>
              </div>
              <div
                class="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border p-5"
              >
                <h3
                  class="text-sm font-semibold mb-3 text-light-font-secondary dark:text-dark-font-secondary"
                >
                  Most Active Time
                </h3>
                <div class="text-2xl font-bold text-accent-primary mb-1">
                  {{ mostActiveTimeOfDay() }}
                </div>
                <div class="text-xs text-light-font-muted dark:text-dark-font-muted">
                  {{ mostActiveTimeOfDayCount() }} entries
                </div>
              </div>
            </div>
          </section>
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
}
