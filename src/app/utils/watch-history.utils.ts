import { HistoryEntry } from '../models/storage.model';

export interface CalendarGroup {
  /** Stable per local day, for tracking. */
  dayKey: string;
  /** One canonical heading, e.g. "Today · Fri, Nov 6", "Wednesday, Nov 4", "Tue, Dec 30, 2025". */
  label: string;
  entries: (HistoryEntry & { relativeTime: string })[];
}

export function groupHistoryEntries(
  entries: readonly HistoryEntry[],
  locale = 'en-US',
  now = new Date(),
): CalendarGroup[] {
  const groups: CalendarGroup[] = [];
  const groupMap = new Map<string, (HistoryEntry & { relativeTime: string })[]>();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const entry of entries) {
    const entryDate = new Date(entry.date);
    const entryDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
    const dayKey = entryDay.toISOString();

    if (!groupMap.has(dayKey)) {
      groupMap.set(dayKey, []);
    }

    groupMap.get(dayKey)!.push({
      ...entry,
      relativeTime: formatClockTime(entryDate),
    });
  }

  groupMap.forEach((dayEntries, dayKey) => {
    const entryDay = new Date(dayKey);
    const daysDiff = Math.round((today.getTime() - entryDay.getTime()) / 86400000);

    groups.push({
      dayKey,
      label: formatDayLabel(entryDay, daysDiff, today, locale),
      entries: dayEntries,
    });
  });

  groups.sort(
    (a, b) => new Date(b.entries[0].date).getTime() - new Date(a.entries[0].date).getTime(),
  );

  return groups;
}

function formatClockTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

function formatDayLabel(date: Date, daysDiff: number, today: Date, locale: string): string {
  const year = date.getFullYear() === today.getFullYear() ? undefined : 'numeric';
  const recent = daysDiff >= 0 && daysDiff <= 6;
  const day = date.toLocaleDateString(locale, {
    weekday: recent && daysDiff > 1 ? 'long' : 'short',
    month: 'short',
    day: 'numeric',
    year,
  });

  if (daysDiff === 0) return `Today · ${day}`;
  if (daysDiff === 1) return `Yesterday · ${day}`;
  return day;
}
