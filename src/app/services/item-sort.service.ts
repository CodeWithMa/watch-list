import { Injectable, inject, signal } from '@angular/core';
import { isSortDirection, isSortField, SortDirection, SortField } from '../utils/sort.utils';
import { BrowserSettingsStorage } from './browser-settings-storage.service';

const SORT_FIELD_KEY = 'itemSortField';
const SORT_DIRECTION_KEY = 'itemSortDirection';

const DEFAULT_SORT_FIELD: SortField = 'createdAt';
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

@Injectable({
  providedIn: 'root',
})
export class ItemSortService {
  private readonly settingsStorage = inject(BrowserSettingsStorage);
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
      const raw = this.settingsStorage.read(SORT_FIELD_KEY);
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
      const raw = this.settingsStorage.read(SORT_DIRECTION_KEY);
      if (raw && isSortDirection(raw)) {
        return raw;
      }
    } catch {
      // ignore read errors
    }
    return DEFAULT_SORT_DIRECTION;
  }

  private saveField(field: SortField): void {
    this.settingsStorage.write(SORT_FIELD_KEY, field);
  }

  private saveDirection(direction: SortDirection): void {
    this.settingsStorage.write(SORT_DIRECTION_KEY, direction);
  }
}
