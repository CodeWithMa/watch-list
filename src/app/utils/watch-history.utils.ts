import { HistoryEntry } from '../models/storage.model';

export interface CalendarGroup {
  relativeLabel: string;
  dateLabel: string;
  entries: (HistoryEntry & { relativeTime: string })[];
}

export function groupHistoryEntries(
  entries: HistoryEntry[],
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
      relativeLabel: formatRelativeDayLabel(entryDay, daysDiff, locale),
      dateLabel: entryDay.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
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

function formatRelativeDayLabel(date: Date, daysDiff: number, locale: string): string {
  if (daysDiff === 0) {
    return 'Today';
  }

  if (daysDiff === 1) {
    return 'Yesterday';
  }

  if (daysDiff <= 6) {
    return date.toLocaleDateString(locale, { weekday: 'long' });
  }

  return date.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
}
