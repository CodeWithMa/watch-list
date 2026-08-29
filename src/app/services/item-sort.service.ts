import { Injectable, signal } from '@angular/core';
import { isSortDirection, isSortField, SortDirection, SortField } from '../utils/sort.utils';

const SORT_FIELD_KEY = 'itemSortField';
const SORT_DIRECTION_KEY = 'itemSortDirection';

const DEFAULT_SORT_FIELD: SortField = 'createdAt';
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

@Injectable({
  providedIn: 'root',
})
export class ItemSortService {
  private readonly fieldSignal = signal<SortField>(this.loadField());
  private readonly directionSignal = signal<SortDirection>(this.loadDirection());

  readonly field = this.fieldSignal.asReadonly();
  readonly direction = this.directionSignal.asReadonly();

  setField(field: SortField): void {
    this.fieldSignal.set(field);
    this.saveField(field);
  }

  setDirection(direction: SortDirection): void {
    this.directionSignal.set(direction);
    this.saveDirection(direction);
  }

  toggleDirection(): void {
    this.setDirection(this.directionSignal() === 'asc' ? 'desc' : 'asc');
  }

  private loadField(): SortField {
    try {
      const raw = localStorage.getItem(SORT_FIELD_KEY);
      if (raw && isSortField(raw)) {
        return raw;
      }
    } catch {
      // ignore read errors, fallback to default
    }
    return DEFAULT_SORT_FIELD;
  }

  private loadDirection(): SortDirection {
    try {
      const raw = localStorage.getItem(SORT_DIRECTION_KEY);
      if (raw && isSortDirection(raw)) {
        return raw;
      }
    } catch {
      // ignore read errors
    }
    return DEFAULT_SORT_DIRECTION;
  }

  private saveField(field: SortField): void {
    try {
      localStorage.setItem(SORT_FIELD_KEY, field);
    } catch {
      // Retain in-memory state even if persistence fails (quota, private mode).
    }
  }

  private saveDirection(direction: SortDirection): void {
    try {
      localStorage.setItem(SORT_DIRECTION_KEY, direction);
    } catch {
      // Retain in-memory state even if persistence fails.
    }
  }
}
