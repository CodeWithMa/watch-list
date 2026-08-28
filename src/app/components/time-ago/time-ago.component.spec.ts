import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TimeAgoComponent } from './time-ago.component';

describe('TimeAgoComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  function create(date: string) {
    const fixture = TestBed.createComponent(TimeAgoComponent);
    fixture.componentRef.setInput('date', date);
    fixture.detectChanges();
    return fixture;
  }

  it('returns just now for <60 seconds', () => {
    const fixture = create('2026-05-15T11:59:30.000Z');
    expect(fixture.componentInstance.timeAgo()).toBe('just now');
  });

  it('returns minutes ago', () => {
    let fixture = create('2026-05-15T11:58:00.000Z');
    expect(fixture.componentInstance.timeAgo()).toBe('2 minutes ago');
    fixture = create('2026-05-15T11:59:00.000Z');
    expect(fixture.componentInstance.timeAgo()).toBe('1 minute ago');
  });

  it('returns hours ago', () => {
    let fixture = create('2026-05-15T10:00:00.000Z');
    expect(fixture.componentInstance.timeAgo()).toBe('2 hours ago');
    fixture = create('2026-05-15T11:00:00.000Z');
    expect(fixture.componentInstance.timeAgo()).toBe('1 hour ago');
  });

  it('returns days ago', () => {
    let fixture = create('2026-05-12T12:00:00.000Z');
    expect(fixture.componentInstance.timeAgo()).toBe('3 days ago');
    fixture = create('2026-05-14T12:00:00.000Z');
    expect(fixture.componentInstance.timeAgo()).toBe('1 day ago');
  });

  it('returns weeks ago', () => {
    let fixture = create('2026-04-24T12:00:00.000Z');
    expect(fixture.componentInstance.timeAgo()).toBe('3 weeks ago');
    fixture = create('2026-05-08T12:00:00.000Z');
    expect(fixture.componentInstance.timeAgo()).toBe('1 week ago');
  });

  it('returns months ago', () => {
    let fixture = create('2026-02-15T12:00:00.000Z');
    expect(fixture.componentInstance.timeAgo()).toBe('2 months ago');
    fixture = create('2026-04-15T12:00:00.000Z');
    expect(fixture.componentInstance.timeAgo()).toBe('1 month ago');
  });

  it('returns years ago', () => {
    let fixture = create('2024-05-15T12:00:00.000Z');
    expect(fixture.componentInstance.timeAgo()).toBe('2 years ago');
    fixture = create('2025-05-15T12:00:00.000Z');
    expect(fixture.componentInstance.timeAgo()).toBe('1 year ago');
  });

  it('formats dateString', () => {
    const fixture = create('2026-05-15T12:00:00.000Z');
    expect(fixture.componentInstance.dateString()).toBe(
      new Date('2026-05-15T12:00:00.000Z').toLocaleString(),
    );
  });
});
