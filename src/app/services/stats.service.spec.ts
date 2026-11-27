import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { StatsService } from './stats.service';
import { WatchListService } from './watch-list.service';
import { Item, ItemStatus, ItemType } from '../models/item.model';
import { HistoryEntry } from '../models/storage.model';

function item(id: string, type: ItemType, status: ItemStatus): Item {
  return {
    id,
    type,
    status,
    title: id,
    groupId: 'ungrouped',
    watchHistory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    isAdult: false,
  };
}

function watchedAt(date: Date): HistoryEntry {
  return { date: date.toISOString(), itemId: 'a', itemTitle: 'A', itemType: 'series' };
}

function setup(items: Item[], history: HistoryEntry[]) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: WatchListService,
        useValue: { items: signal(items), history: signal(history) },
      },
    ],
  });
  return TestBed.inject(StatsService);
}

describe('StatsService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts episodic types as series and movies separately by status', () => {
    const stats = setup(
      [
        item('s1', 'series', 'in-progress'),
        item('s2', 'ova', 'completed'),
        item('s3', 'ona', 'completed'),
        item('m1', 'movie', 'completed'),
        item('m2', 'movie', 'dropped'),
      ],
      [],
    );

    expect(stats.seriesCountByStatus()).toEqual({
      'not-started': 0,
      'in-progress': 1,
      paused: 0,
      completed: 2,
      dropped: 0,
    });
    expect(stats.moviesCountByStatus()).toEqual({
      'not-started': 0,
      'in-progress': 0,
      paused: 0,
      completed: 1,
      dropped: 1,
    });
  });

  it('counts a current streak of consecutive days ending today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 27, 20));
    const stats = setup(
      [],
      [
        watchedAt(new Date(2026, 10, 27, 9)),
        watchedAt(new Date(2026, 10, 26, 21)),
        watchedAt(new Date(2026, 10, 25, 14)),
        watchedAt(new Date(2026, 10, 23, 14)),
      ],
    );

    expect(stats.currentStreak()).toBe(3);
  });

  it('keeps the current streak alive when the last watch was yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 27, 20));
    const stats = setup(
      [],
      [watchedAt(new Date(2026, 10, 26, 21)), watchedAt(new Date(2026, 10, 25, 14))],
    );

    expect(stats.currentStreak()).toBe(2);
  });

  it('resets the current streak after a missed day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 27, 20));
    const stats = setup([], [watchedAt(new Date(2026, 10, 25, 14))]);

    expect(stats.currentStreak()).toBe(0);
  });

  it('buckets watches into morning, afternoon, evening and night', () => {
    const stats = setup(
      [],
      [
        watchedAt(new Date(2026, 10, 20, 6)),
        watchedAt(new Date(2026, 10, 20, 13)),
        watchedAt(new Date(2026, 10, 20, 19)),
        watchedAt(new Date(2026, 10, 20, 23)),
        watchedAt(new Date(2026, 10, 21, 2)),
      ],
    );

    expect(stats.mostActiveTimeOfDay()).toBe('Night');
    expect(stats.mostActiveTimeOfDayCount()).toBe(2);
  });

  it('reports no active time of day without history', () => {
    const stats = setup([], []);

    expect(stats.mostActiveTimeOfDay()).toBe('—');
  });
});
