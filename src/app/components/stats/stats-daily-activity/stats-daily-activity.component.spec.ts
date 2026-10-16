import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HistoryEntry } from '../../../models/storage.model';
import { StatsDailyActivityComponent } from './stats-daily-activity.component';

describe('StatsDailyActivityComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 16, 12));
  });

  afterEach(() => vi.useRealTimers());

  function entry(date: Date, isDeleted = false): HistoryEntry {
    return {
      date: date.toISOString(),
      itemId: 'item-1',
      itemTitle: 'Example',
      itemType: 'movie',
      isDeleted,
    };
  }

  function render(history: HistoryEntry[]) {
    const fixture = TestBed.createComponent(StatsDailyActivityComponent);
    fixture.componentRef.setInput('historyEntries', history);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element };
  }

  it('shows local weekday/hour counts and an hourly mean across all seven weekdays', () => {
    const { element } = render([
      entry(new Date(2026, 9, 5, 18)),
      entry(new Date(2026, 9, 12, 18), true),
      entry(new Date(2026, 9, 13, 0, 30)),
    ]);

    const rows = [...element.querySelectorAll('tbody tr')];
    expect(rows.map((row) => row.querySelector('th')?.textContent?.trim())).toEqual([
      'Average',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(rows.every((row) => row.querySelectorAll('td').length === 24)).toBe(true);
    expect(element.querySelector('[aria-label="Monday, 18:00–19:00: 2 entries"]')).not.toBeNull();
    expect(element.querySelector('[aria-label="Tuesday, 00:00–01:00: 1 entry"]')).not.toBeNull();
    expect(element.querySelector('[aria-label="Sunday, 23:00–24:00: 0 entries"]')).not.toBeNull();
    expect(
      element.querySelector('[aria-label="Average, 18:00–19:00: 0.29 entries (weekday mean)"]'),
    ).not.toBeNull();
  });

  it('switches between 30 days, 365 days, and all time using inclusive local date boundaries', () => {
    const { fixture, element } = render([
      entry(new Date(2026, 8, 17)),
      entry(new Date(2026, 8, 16, 23, 59)),
      entry(new Date(2025, 9, 17)),
      entry(new Date(2025, 9, 16, 23, 59)),
      entry(new Date(2026, 9, 16, 11)),
      entry(new Date(2026, 9, 17)),
      { ...entry(new Date()), date: 'invalid' },
    ]);
    const select = element.querySelector('select')!;
    expect(select).not.toBeNull();
    expect(select.value).toBe('year');
    const hasCell = (label: string) =>
      expect(element.querySelector(`[aria-label="${label}"]`)).not.toBeNull();

    hasCell('Thursday, 00:00–01:00: 1 entry');
    hasCell('Wednesday, 23:00–24:00: 1 entry');
    hasCell('Friday, 00:00–01:00: 1 entry');
    hasCell('Thursday, 23:00–24:00: 0 entries');
    hasCell('Friday, 11:00–12:00: 1 entry');
    hasCell('Saturday, 00:00–01:00: 0 entries');

    select.value = 'month';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    hasCell('Thursday, 00:00–01:00: 1 entry');
    hasCell('Wednesday, 23:00–24:00: 0 entries');
    hasCell('Friday, 00:00–01:00: 0 entries');

    select.value = 'all';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    hasCell('Thursday, 23:00–24:00: 1 entry');
    hasCell('Saturday, 00:00–01:00: 0 entries');
  });

  it('shows cell details for keyboard and touch, and refreshes them when history changes', () => {
    const { fixture, element } = render([entry(new Date(2026, 9, 12, 18))]);
    const cell = element.querySelector<HTMLButtonElement>(
      '[aria-label="Monday, 18:00–19:00: 1 entry"]',
    )!;
    cell.focus();
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Monday, 18:00–19:00: 1 entry',
    );

    fixture.componentRef.setInput('historyEntries', []);
    fixture.detectChanges();
    expect(element.textContent).toContain('No watch activity in this range.');
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Monday, 18:00–19:00: 0 entries',
    );

    element
      .querySelector<HTMLButtonElement>(
        '[aria-label="Average, 00:00–01:00: 0 entries (weekday mean)"]',
      )!
      .click();
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Average, 00:00–01:00: 0 entries (weekday mean)',
    );
  });
});
