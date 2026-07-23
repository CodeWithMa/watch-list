import { Component, computed, input } from '@angular/core';
import { HistoryEntry } from '../../../models/storage.model';
import { toLocalDateKey, toLocalDateKeyFromISO } from '../../../utils/date.utils';

interface DayCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3;
}

interface MonthLabel {
  label: string;
  weekIndex: number;
}

@Component({
  selector: 'app-stats-heatmap',
  template: `
    <div class="overflow-x-auto">
      <div class="inline-block min-w-[720px]">
        <div class="relative h-[14px] mb-1">
          @for (month of monthLabels(); track month.label + month.weekIndex) {
            <span
              class="absolute text-[10px] text-light-font-muted dark:text-dark-font-muted -translate-x-1/2"
              [style.left]="month.weekIndex * 16 + 36 + 'px'"
            >
              {{ month.label }}
            </span>
          }
        </div>

        <div class="flex gap-0">
          <div class="flex flex-col gap-[3px] mr-1">
            @for (dayLabel of dayLabels; track dayLabel) {
              <span
                class="text-[10px] text-light-font-muted dark:text-dark-font-muted h-[13px] leading-[13px] text-right"
              >
                {{ dayLabel }}
              </span>
            }
          </div>

          <div class="flex gap-[3px]">
            @for (week of weeks(); track $index) {
              <div class="flex flex-col gap-[3px]">
                @for (day of week; track day.date) {
                  <div
                    class="w-[13px] h-[13px] rounded-[2px] relative group cursor-default"
                    [class]="getCellClass(day.level)"
                  >
                    <div
                      class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-light-bg-primary dark:bg-dark-bg-primary border border-light-border dark:border-dark-border rounded text-xs text-light-font dark:text-dark-font whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-light dark:shadow-dark"
                    >
                      <span class="font-medium"
                        >{{ day.count }} {{ day.count === 1 ? 'entry' : 'entries' }}</span
                      >
                      <span class="text-light-font-muted dark:text-dark-font-muted ml-1">{{
                        formatTooltipDate(day.date)
                      }}</span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <div class="flex items-center gap-2 mt-3 justify-end">
          <span class="text-[10px] text-light-font-muted dark:text-dark-font-muted">Less</span>
          <div
            class="w-[13px] h-[13px] rounded-[2px] bg-light-bg-tertiary dark:bg-dark-bg-tertiary"
          ></div>
          <div class="w-[13px] h-[13px] rounded-[2px] bg-accent-primary/25"></div>
          <div class="w-[13px] h-[13px] rounded-[2px] bg-accent-primary/50"></div>
          <div class="w-[13px] h-[13px] rounded-[2px] bg-accent-primary"></div>
          <span class="text-[10px] text-light-font-muted dark:text-dark-font-muted">More</span>
        </div>
      </div>
    </div>
  `,
})
export class StatsHeatmapComponent {
  historyEntries = input.required<HistoryEntry[]>();

  dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  private entryCountByDate = computed(() => {
    const map = new Map<string, number>();
    for (const entry of this.historyEntries()) {
      const dateKey = toLocalDateKeyFromISO(entry.date);
      map.set(dateKey, (map.get(dateKey) ?? 0) + 1);
    }
    return map;
  });

  private allDays = computed(() => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - 364);

    const startDay = start.getDay();
    const adjustedStart = new Date(start);
    adjustedStart.setDate(adjustedStart.getDate() - startDay);

    const days: DayCell[] = [];
    const current = new Date(adjustedStart);
    const counts = this.entryCountByDate();

    while (current <= end) {
      const dateKey = toLocalDateKey(current);
      const count = counts.get(dateKey) ?? 0;
      let level: 0 | 1 | 2 | 3 = 0;
      if (count >= 3) level = 3;
      else if (count >= 2) level = 2;
      else if (count >= 1) level = 1;

      days.push({ date: dateKey, count, level });
      current.setDate(current.getDate() + 1);
    }

    return days;
  });

  weeks = computed(() => {
    const days = this.allDays();
    const result: DayCell[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  });

  monthLabels = computed(() => {
    const weeks = this.weeks();
    const labels: MonthLabel[] = [];
    let lastMonth = -1;

    for (let i = 0; i < weeks.length; i++) {
      const firstDayOfWeek = weeks[i][0];
      if (!firstDayOfWeek) continue;

      const parts = firstDayOfWeek.date.split('-');
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const month = date.getMonth();

      if (month !== lastMonth) {
        labels.push({
          label: date.toLocaleDateString('en-US', { month: 'short' }),
          weekIndex: i,
        });
        lastMonth = month;
      }
    }

    return labels;
  });

  getCellClass(level: 0 | 1 | 2 | 3): string {
    switch (level) {
      case 0:
        return 'bg-light-bg-tertiary dark:bg-dark-bg-tertiary';
      case 1:
        return 'bg-accent-primary/25';
      case 2:
        return 'bg-accent-primary/50';
      case 3:
        return 'bg-accent-primary';
    }
  }

  formatTooltipDate(dateStr: string): string {
    const parts = dateStr.split('-');
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
