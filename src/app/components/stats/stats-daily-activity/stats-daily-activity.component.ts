import { Component, computed, input } from '@angular/core';
import { HistoryEntry } from '../../../models/storage.model';

@Component({
  selector: 'app-stats-daily-activity',
  template: `
    @if (!hasActivity()) {
      <p class="text-sm text-light-font-muted dark:text-dark-font-muted mb-3">
        No watch activity yet.
      </p>
    }
    <div class="overflow-x-auto">
      <table class="w-max border-separate border-spacing-1">
        <caption class="sr-only">
          Watch entries by weekday and local hour
        </caption>
        <colgroup>
          <col class="w-24" />
          <col span="24" class="w-7" />
        </colgroup>
        <thead class="sr-only">
          <tr>
            <th scope="col">Weekday</th>
            @for (hour of hours; track hour) {
              <th scope="col">{{ hour }}:00</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.label) {
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
                    class="block w-7 h-7 rounded-sm cursor-default focus-visible:outline-2 focus-visible:outline-accent-primary focus-visible:outline-offset-2"
                    [class]="cell.color"
                    [attr.aria-label]="cell.label"
                    [title]="cell.label"
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
  `,
})
export class StatsDailyActivityComponent {
  readonly historyEntries = input.required<HistoryEntry[]>();
  readonly hours = Array.from({ length: 24 }, (_, hour) => hour);
  readonly hasActivity = computed(() =>
    this.counts().some((day) => day.some((count) => count > 0)),
  );

  private readonly counts = computed(() => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const counts = Array.from({ length: 7 }, () => this.hours.map(() => 0));
    for (const entry of this.historyEntries()) {
      const date = new Date(entry.date);
      if (!Number.isFinite(date.getTime())) continue;
      if (date >= end) continue;
      const weekday = (date.getDay() + 6) % 7;
      counts[weekday][date.getHours()]++;
    }
    return counts;
  });

  readonly rows = computed(() => {
    const counts = this.counts();
    const max = Math.max(...counts.flat());
    const labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return counts.map((values, index) => ({
      label: labels[index],
      cells: values.map((value, hour) => {
        const start = `${String(hour).padStart(2, '0')}:00`;
        const end = `${String(hour + 1).padStart(2, '0')}:00`;
        const formatted = value.toLocaleString('en-US');
        return {
          hour,
          label: `${labels[index]}, ${start}–${end}: ${formatted} ${value === 1 ? 'entry' : 'entries'}`,
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
