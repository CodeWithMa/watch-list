import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-time-ago',
  imports: [],
  template: `
    <span
      [title]="dateString()"
      class="text-light-font-secondary dark:text-dark-font-secondary text-[0.9em]"
      >{{ timeAgo() }}</span
    >
  `,
})
export class TimeAgoComponent {
  date = input.required<string>();

  dateString = computed(() => new Date(this.date()).toLocaleString());

  timeAgo = computed(() => {
    const date = new Date(this.date());
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return ago(diffMinutes, 'minute');
    if (diffHours < 24) return ago(diffHours, 'hour');
    if (diffDays < 7) return ago(diffDays, 'day');
    if (diffWeeks < 4) return ago(diffWeeks, 'week');
    if (diffMonths < 12) return ago(diffMonths, 'month');
    return ago(diffYears, 'year');
  });
}

function ago(count: number, unit: string) {
  return `${count} ${unit}${count > 1 ? 's' : ''} ago`;
}
