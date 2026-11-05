import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
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
  host: { '(window:resize)': 'onResize()' },
  template: `
    @if (canScroll()) {
      <div class="flex items-center justify-between gap-3 mb-2 min-h-11">
        <p class="m-0 text-xs text-light-font-secondary dark:text-dark-font-secondary">
          Past year · scroll sideways to explore
        </p>
        @if (!showingToday()) {
          <button type="button" (click)="showToday()" class="btn btn-secondary shrink-0">
            Today
          </button>
        }
      </div>
    }
    <div
      #scroller
      (scroll)="syncScrollState()"
      role="group"
      aria-label="Watch activity for the past year"
      [attr.tabindex]="canScroll() ? 0 : null"
      class="relative overflow-x-auto"
    >
      <div class="inline-block min-w-[720px]">
        <div class="relative h-4 mb-1">
          @for (month of monthLabels(); track month.label + month.weekIndex) {
            <span
              class="absolute text-xs text-light-font-secondary dark:text-dark-font-secondary -translate-x-1/2"
              [style.left]="month.weekIndex * 16 + 36 + 'px'"
            >
              {{ month.label }}
            </span>
          }
        </div>

        <div class="flex gap-0">
          <div
            class="sticky left-0 z-10 flex flex-col gap-[3px] pr-1 bg-light-bg-secondary dark:bg-dark-bg-secondary"
          >
            @for (dayLabel of dayLabels; track dayLabel) {
              <span
                class="text-xs text-light-font-secondary dark:text-dark-font-secondary h-[13px] leading-[13px] text-right w-7"
              >
                {{ dayLabel }}
              </span>
            }
          </div>

          <div class="flex gap-[3px]">
            @for (week of weeks(); track $index) {
              <div class="flex flex-col gap-[3px]">
                @for (day of week; track day.date) {
                  <button
                    type="button"
                    class="block w-[13px] h-[13px] rounded-[2px] cursor-pointer"
                    [class]="getCellClass(day.level)"
                    [title]="getCellLabel(day)"
                    [attr.aria-label]="getCellLabel(day)"
                    [attr.data-date]="day.date"
                    [attr.tabindex]="day.date === activeDate() ? 0 : -1"
                    (focus)="selectDay(day)"
                    (click)="selectDay(day)"
                    (keydown)="onCellKeydown($event, day)"
                  ></button>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mt-3">
      <p class="meta m-0 min-h-5" aria-live="polite">
        {{ selectedDay() ?? 'Select a day to see its watches' }}
      </p>
      <div class="flex items-center gap-2">
        <span class="meta mr-1">Watches per day</span>
        <span class="text-xs text-light-font-secondary dark:text-dark-font-secondary">Less</span>
        <div class="w-[13px] h-[13px] rounded-[2px] bg-light-border dark:bg-dark-border"></div>
        <div class="w-[13px] h-[13px] rounded-[2px] bg-accent-text/35"></div>
        <div class="w-[13px] h-[13px] rounded-[2px] bg-accent-text/65"></div>
        <div class="w-[13px] h-[13px] rounded-[2px] bg-accent-text"></div>
        <span class="text-xs text-light-font-secondary dark:text-dark-font-secondary">More</span>
      </div>
    </div>
  `,
})
export class StatsHeatmapComponent {
  historyEntries = input.required<readonly Readonly<HistoryEntry>[]>();
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  readonly canScroll = signal(false);
  readonly showingToday = signal(true);
  readonly selectedDay = signal<string | null>(null);
  private readonly selectedDate = signal<string | null>(null);
  // One tab stop for the whole year; arrow keys move between days.
  protected readonly activeDate = computed(
    () => this.selectedDate() ?? this.weeks().flat().at(-1)?.date,
  );

  constructor() {
    // Narrow screens start at the newest weeks; older months are one swipe away.
    afterNextRender(() => this.showToday());
  }

  showToday() {
    const element = this.scroller().nativeElement;
    element.scrollLeft = element.scrollWidth;
    this.syncScrollState();
  }

  // Columns have a fixed width, so a chosen historical position needs no adjustment on resize.
  onResize() {
    if (this.showingToday()) this.showToday();
    else this.syncScrollState();
  }

  syncScrollState() {
    const { clientWidth, scrollLeft, scrollWidth } = this.scroller().nativeElement;
    this.canScroll.set(scrollWidth > clientWidth);
    this.showingToday.set(scrollLeft + clientWidth >= scrollWidth - 1);
  }

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

  selectDay(day: DayCell) {
    this.selectedDate.set(day.date);
    this.selectedDay.set(this.getCellLabel(day));
  }

  onCellKeydown(event: KeyboardEvent, day: DayCell) {
    const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const days = this.weeks().flat();
    const target = days[days.findIndex(({ date }) => date === day.date) + step];
    if (!target) return;
    this.selectedDate.set(target.date);
    this.scroller()
      .nativeElement.querySelector<HTMLElement>(`[data-date="${target.date}"]`)
      ?.focus();
  }

  getCellLabel({ count, date }: DayCell) {
    return `${count} ${count === 1 ? 'entry' : 'entries'}, ${this.formatTooltipDate(date)}`;
  }

  getCellClass(level: 0 | 1 | 2 | 3): string {
    switch (level) {
      case 0:
        return 'bg-light-border dark:bg-dark-border';
      case 1:
        return 'bg-accent-text/35';
      case 2:
        return 'bg-accent-text/65';
      case 3:
        return 'bg-accent-text';
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
