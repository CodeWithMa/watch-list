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

  it('shows local weekday/hour counts for Monday through Sunday', () => {
    const { element } = render([
      entry(new Date(2026, 9, 5, 18)),
      entry(new Date(2026, 9, 12, 18), true),
      entry(new Date(2026, 9, 13, 0, 30)),
    ]);

    const rows = [...element.querySelectorAll('tbody tr')];
    expect(rows.map((row) => row.querySelector('th')?.textContent?.trim())).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(rows.every((row) => row.querySelectorAll('td').length === 24)).toBe(true);
    expect(element.querySelector('[title="Monday, 18:00–19:00: 2 entries"]')).not.toBeNull();
    expect(element.querySelector('[title="Tuesday, 00:00–01:00: 1 entry"]')).not.toBeNull();
    expect(element.querySelector('[title="Sunday, 23:00–24:00: 0 entries"]')).not.toBeNull();
  });

  it('includes all past history without a range selector and ignores invalid or future dates', () => {
    const { element } = render([
      entry(new Date(2025, 9, 16, 23, 59)),
      entry(new Date(2026, 9, 16, 11)),
      entry(new Date(2026, 9, 17)),
      { ...entry(new Date()), date: 'invalid' },
    ]);
    expect(element.querySelector('select')).toBeNull();
    const hasCell = (label: string) =>
      expect(element.querySelector(`[title="${label}"]`)).not.toBeNull();

    hasCell('Thursday, 23:00–24:00: 1 entry');
    hasCell('Friday, 11:00–12:00: 1 entry');
    hasCell('Saturday, 00:00–01:00: 0 entries');
  });

  it('refreshes cell counts and the empty state when history changes', () => {
    const { fixture, element } = render([entry(new Date(2026, 9, 12, 18))]);
    expect(element.querySelector('[title="Monday, 18:00–19:00: 1 entry"]')).not.toBeNull();

    fixture.componentRef.setInput('historyEntries', []);
    fixture.detectChanges();
    expect(element.textContent).toContain('No watch activity yet.');
    expect(element.querySelector('[title="Monday, 18:00–19:00: 0 entries"]')).not.toBeNull();
    expect(element.querySelector('[role="status"]')).toBeNull();
  });

  it('exposes read-only cell counts without adding keyboard tab stops', () => {
    const { element } = render([entry(new Date(2026, 9, 12, 18))]);

    expect(
      element.querySelectorAll('button, a[href], input, select, textarea, [tabindex]'),
    ).toHaveLength(0);
    const cell = element.querySelector('td[title="Monday, 18:00–19:00: 1 entry"]');
    expect(cell?.textContent).toContain('Monday, 18:00–19:00: 1 entry');
  });
});
