import { Component, computed, input, signal } from '@angular/core';
import { HistoryEntry } from '../../../models/storage.model';

@Component({
  selector: 'app-stats-daily-activity',
  template: `
    <label
      class="flex items-center gap-2 mb-3 text-sm text-light-font-secondary dark:text-dark-font-secondary"
    >
      Date range
      <select
        #rangeSelect
        [value]="range()"
        (change)="setRange(rangeSelect.value)"
        class="px-3 py-2 bg-light-bg-primary dark:bg-dark-bg-primary border border-light-border dark:border-dark-border rounded-lg text-light-font dark:text-dark-font"
      >
        <option value="month">Past month (30 days)</option>
        <option value="year">Past year (365 days)</option>
        <option value="all">All time</option>
      </select>
    </label>
    <p class="text-xs text-light-font-muted dark:text-dark-font-muted mb-4">
      Watch entries by local weekday and hour. Average is each hour's total divided by 7 weekdays.
    </p>
    @if (!hasActivity()) {
      <p class="text-sm text-light-font-muted dark:text-dark-font-muted mb-3">
        No watch activity in this range.
      </p>
    }
    <div class="overflow-x-auto">
      <table class="w-full min-w-[720px] border-separate border-spacing-1">
        <caption class="sr-only">
          Watch entries by weekday and local hour
        </caption>
        <thead class="sr-only">
          <tr>
            <th scope="col">Weekday</th>
            @for (hour of hours; track hour) {
              <th scope="col">{{ hour }}:00</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.label; let rowIndex = $index) {
            <tr>
              <th
                scope="row"
                class="text-right pr-2 text-xs font-normal text-light-font-secondary dark:text-dark-font-secondary"
              >
                {{ row.label }}
              </th>
              @for (cell of row.cells; track cell.hour) {
                <td class="p-0">
                  <button
                    type="button"
                    class="block w-full h-7 rounded-sm cursor-default focus-visible:outline-2 focus-visible:outline-accent-primary focus-visible:outline-offset-2"
                    [class]="cell.color"
                    [attr.aria-label]="cell.label"
                    [title]="cell.label"
                    (mouseenter)="activeCell.set({ row: rowIndex, hour: cell.hour })"
                    (focus)="activeCell.set({ row: rowIndex, hour: cell.hour })"
                    (click)="activeCell.set({ row: rowIndex, hour: cell.hour })"
                  ></button>
                </td>
              }
            </tr>
          }
        </tbody>
        <tfoot aria-hidden="true">
          <tr>
            <td></td>
            @for (hour of hours; track hour) {
              <td class="text-center text-[10px] text-light-font-muted dark:text-dark-font-muted">
                {{ hour }}
              </td>
            }
          </tr>
        </tfoot>
      </table>
    </div>
    <div
      class="flex items-center justify-end gap-2 mt-3 text-[10px] text-light-font-muted dark:text-dark-font-muted"
      aria-hidden="true"
    >
      <span>Less</span>
      <span class="w-3 h-3 rounded-sm bg-light-bg-tertiary dark:bg-dark-bg-tertiary"></span>
      <span class="w-3 h-3 rounded-sm bg-accent-primary/25"></span>
      <span class="w-3 h-3 rounded-sm bg-accent-primary/50"></span>
      <span class="w-3 h-3 rounded-sm bg-accent-primary"></span>
      <span>More</span>
    </div>
    <p role="status" class="mt-3 text-xs text-light-font-secondary dark:text-dark-font-secondary">
      {{ activeCellLabel() }}
    </p>
  `,
})
export class StatsDailyActivityComponent {
  readonly historyEntries = input.required<HistoryEntry[]>();
  readonly hours = Array.from({ length: 24 }, (_, hour) => hour);
  readonly range = signal<'month' | 'year' | 'all'>('year');
  readonly activeCell = signal<{ row: number; hour: number } | null>(null);

  readonly activeCellLabel = computed(() => {
    const cell = this.activeCell();
    return cell
      ? this.rows()[cell.row].cells[cell.hour].label
      : 'Hover, focus, or tap a cell to see its count.';
  });

  readonly hasActivity = computed(() =>
    this.counts().some((day) => day.some((count) => count > 0)),
  );

  setRange(value: string) {
    if (value === 'month' || value === 'year' || value === 'all') this.range.set(value);
  }

  private readonly counts = computed(() => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    start.setDate(start.getDate() - (this.range() === 'month' ? 29 : 364));
    const counts = Array.from({ length: 7 }, () => this.hours.map(() => 0));
    for (const entry of this.historyEntries()) {
      const date = new Date(entry.date);
      if (!Number.isFinite(date.getTime())) continue;
      if (date >= end || (this.range() !== 'all' && date < start)) continue;
      const weekday = (date.getDay() + 6) % 7;
      counts[weekday][date.getHours()]++;
    }
    return counts;
  });

  readonly rows = computed(() => {
    const counts = this.counts();
    const averages = this.hours.map(
      (hour) => counts.reduce((total, day) => total + day[hour], 0) / 7,
    );
    const max = Math.max(...counts.flat());
    const labels = [
      'Average',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    return [averages, ...counts].map((values, index) => ({
      label: labels[index],
      cells: values.map((value, hour) => {
        const start = `${String(hour).padStart(2, '0')}:00`;
        const end = `${String(hour + 1).padStart(2, '0')}:00`;
        const formatted = value.toLocaleString('en-US', { maximumFractionDigits: 2 });
        return {
          hour,
          label: `${labels[index]}, ${start}–${end}: ${formatted} ${value === 1 ? 'entry' : 'entries'}${index === 0 ? ' (weekday mean)' : ''}`,
          color:
            value === 0
              ? 'bg-light-bg-tertiary dark:bg-dark-bg-tertiary'
              : value <= max / 3
                ? 'bg-accent-primary/25'
                : value <= (max * 2) / 3
                  ? 'bg-accent-primary/50'
                  : 'bg-accent-primary',
        };
      }),
    }));
  });
}
