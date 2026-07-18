import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WatchListService } from '../../services/watch-list.service';
import { StatsHeatmapComponent } from './stats-heatmap/stats-heatmap.component';

@Component({
  selector: 'app-stats',
  imports: [RouterLink, StatsHeatmapComponent],
  template: `
    <div class="max-w-[1000px] mx-auto p-8">
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
                      seriesCountByStatus()['in-progress'] ?? 0
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Completed</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      seriesCountByStatus()['completed'] ?? 0
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Dropped</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      seriesCountByStatus()['dropped'] ?? 0
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Not Started</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      seriesCountByStatus()['not-started'] ?? 0
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
                      moviesCountByStatus()['in-progress'] ?? 0
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Completed</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      moviesCountByStatus()['completed'] ?? 0
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Dropped</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      moviesCountByStatus()['dropped'] ?? 0
                    }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-light-font-muted dark:text-dark-font-muted">Not Started</span>
                    <span class="font-medium text-light-font dark:text-dark-font">{{
                      moviesCountByStatus()['not-started'] ?? 0
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
  private watchListService = inject(WatchListService);

  items = this.watchListService.items;
  history = this.watchListService.history;

  totalItems = computed(() => this.items().length);

  inProgressCount = computed(() => this.items().filter((i) => i.status === 'in-progress').length);
  completedCount = computed(() => this.items().filter((i) => i.status === 'completed').length);
  droppedCount = computed(() => this.items().filter((i) => i.status === 'dropped').length);

  totalEpisodesWatched = computed(() => {
    let count = 0;
    for (const item of this.items()) {
      if (item.type === 'series') {
        count += item.watchHistory.length;
      }
    }
    return count;
  });

  private seriesCountByStatus = computed(() => {
    const counts: Record<string, number> = {};
    for (const item of this.items()) {
      if (item.type === 'series') {
        counts[item.status] = (counts[item.status] ?? 0) + 1;
      }
    }
    return counts;
  });

  private moviesCountByStatus = computed(() => {
    const counts: Record<string, number> = {};
    for (const item of this.items()) {
      if (item.type === 'movie') {
        counts[item.status] = (counts[item.status] ?? 0) + 1;
      }
    }
    return counts;
  });

  mostWatchedItems = computed(() => {
    return [...this.items()]
      .filter((i) => i.watchHistory.length > 0)
      .sort((a, b) => b.watchHistory.length - a.watchHistory.length)
      .slice(0, 10);
  });

  avgEpisodesPerActiveSeries = computed(() => {
    const activeSeries = this.items().filter(
      (i) => i.type === 'series' && i.status === 'in-progress',
    );
    if (activeSeries.length === 0) return '0';
    const totalEps = activeSeries.reduce((sum, s) => sum + s.watchHistory.length, 0);
    return (totalEps / activeSeries.length).toFixed(1);
  });

  avgTimeToComplete = computed(() => {
    const completed = this.items().filter((i) => i.type === 'movie' && i.status === 'completed');
    if (completed.length === 0) return 'N/A';
    const totalMs = completed.reduce((sum, item) => {
      const created = new Date(item.createdAt).getTime();
      const lastWatch =
        item.watchHistory.length > 0
          ? new Date(item.watchHistory[item.watchHistory.length - 1].date).getTime()
          : created;
      return sum + (lastWatch - created);
    }, 0);
    const avgDays = totalMs / completed.length / (1000 * 60 * 60 * 24);
    const rounded = Math.round(avgDays);
    if (rounded <= 0) return '< 1 day';
    if (rounded === 1) return '1 day';
    return `${rounded} days`;
  });

  private static toLocalDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private static toLocalDateKeyFromISO(iso: string): string {
    return StatsComponent.toLocalDateKey(new Date(iso));
  }

  private uniqueWatchDates = computed(() => {
    const dates = new Set<string>();
    for (const entry of this.history()) {
      dates.add(StatsComponent.toLocalDateKeyFromISO(entry.date));
    }
    return dates;
  });

  totalDaysWatched = computed(() => this.uniqueWatchDates().size);

  currentStreak = computed(() => this.computeCurrentStreak());
  longestStreak = computed(() => this.computeLongestStreak());

  private computeCurrentStreak(): number {
    const dates = this.uniqueWatchDates();
    if (dates.size === 0) return 0;

    const today = new Date();
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (!dates.has(StatsComponent.toLocalDateKey(current))) {
      current.setDate(current.getDate() - 1);
      if (!dates.has(StatsComponent.toLocalDateKey(current))) {
        return 0;
      }
    }

    let streak = 0;
    while (true) {
      const key = StatsComponent.toLocalDateKey(current);
      if (dates.has(key)) {
        streak++;
        current.setDate(current.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  private static daysBetween(
    y1: number,
    m1: number,
    d1: number,
    y2: number,
    m2: number,
    d2: number,
  ): number {
    const toOrdinal = (y: number, m: number, d: number): number => {
      const a = Math.floor((14 - m) / 12);
      const y2 = y + 4800 - a;
      const m2 = m + 12 * a - 3;
      return (
        d +
        Math.floor((153 * m2 + 2) / 5) +
        365 * y2 +
        Math.floor(y2 / 4) -
        Math.floor(y2 / 100) +
        Math.floor(y2 / 400) -
        32045
      );
    };
    return toOrdinal(y2, m2, d2) - toOrdinal(y1, m1, d1);
  }

  private computeLongestStreak(): number {
    const dates = [...this.uniqueWatchDates()].sort();
    if (dates.length === 0) return 0;

    let longest = 1;
    let current = 1;

    for (let i = 1; i < dates.length; i++) {
      const [py, pm, pd] = dates[i - 1].split('-').map(Number);
      const [cy, cm, cd] = dates[i].split('-').map(Number);

      if (StatsComponent.daysBetween(py, pm, pd, cy, cm, cd) === 1) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }

    return longest;
  }

  private dayOfWeekCounts = computed(() => {
    const counts = new Array(7).fill(0);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const entry of this.history()) {
      const day = new Date(entry.date).getDay();
      counts[day]++;
    }
    return { counts, dayNames };
  });

  mostActiveDay = computed(() => {
    const { counts, dayNames } = this.dayOfWeekCounts();
    const max = Math.max(...counts);
    if (max === 0) return '—';
    return dayNames[counts.indexOf(max)];
  });

  mostActiveDayCount = computed(() => {
    const { counts } = this.dayOfWeekCounts();
    return Math.max(...counts);
  });

  private timeOfDayCounts = computed(() => {
    const periods = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
    for (const entry of this.history()) {
      const hour = new Date(entry.date).getHours();
      if (hour >= 6 && hour < 12) periods['Morning']++;
      else if (hour >= 12 && hour < 18) periods['Afternoon']++;
      else if (hour >= 18 && hour < 22) periods['Evening']++;
      else periods['Night']++;
    }
    return periods;
  });

  mostActiveTimeOfDay = computed(() => {
    const periods = this.timeOfDayCounts();
    let maxKey = '—';
    let maxVal = 0;
    for (const [key, val] of Object.entries(periods)) {
      if (val > maxVal) {
        maxVal = val;
        maxKey = key;
      }
    }
    return maxKey;
  });

  mostActiveTimeOfDayCount = computed(() => {
    const periods = this.timeOfDayCounts();
    return Math.max(...Object.values(periods));
  });
}
