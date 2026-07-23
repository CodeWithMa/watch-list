import { Injectable, inject, computed } from '@angular/core';
import { WatchListService } from './watch-list.service';
import { daysBetween, toLocalDateKey, toLocalDateKeyFromISO } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class StatsService {
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

  seriesCountByStatus = computed(() => {
    const counts: Record<string, number> = {
      'not-started': 0,
      'in-progress': 0,
      completed: 0,
      dropped: 0,
    };
    for (const item of this.items()) {
      if (item.type === 'series') {
        counts[item.status]++;
      }
    }
    return counts;
  });

  moviesCountByStatus = computed(() => {
    const counts: Record<string, number> = {
      'not-started': 0,
      'in-progress': 0,
      completed: 0,
      dropped: 0,
    };
    for (const item of this.items()) {
      if (item.type === 'movie') {
        counts[item.status]++;
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

  private uniqueWatchDates = computed(() => {
    const dates = new Set<string>();
    for (const entry of this.history()) {
      dates.add(toLocalDateKeyFromISO(entry.date));
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

    if (!dates.has(toLocalDateKey(current))) {
      current.setDate(current.getDate() - 1);
      if (!dates.has(toLocalDateKey(current))) {
        return 0;
      }
    }

    let streak = 0;
    while (true) {
      const key = toLocalDateKey(current);
      if (dates.has(key)) {
        streak++;
        current.setDate(current.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  private computeLongestStreak(): number {
    const dates = [...this.uniqueWatchDates()].sort();
    if (dates.length === 0) return 0;

    let longest = 1;
    let current = 1;

    for (let i = 1; i < dates.length; i++) {
      const [py, pm, pd] = dates[i - 1].split('-').map(Number);
      const [cy, cm, cd] = dates[i].split('-').map(Number);

      if (daysBetween(py, pm, pd, cy, cm, cd) === 1) {
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
