import { Component, ElementRef, computed, signal, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { ItemSortService } from '../../services/item-sort.service';
import {
  ITEM_STATUSES,
  ITEM_STATUS_LABELS,
  ITEM_TYPES,
  ITEM_TYPE_LABELS,
} from '../../domain/item.constants';
import { FilterStatus } from '../../utils/status.utils';
import { FilterType } from '../../utils/type.utils';
import {
  SORT_OPTIONS,
  SortDirection,
  SortField,
  isSortDirection,
  isSortField,
  sortItems,
  sortLabel,
} from '../../utils/sort.utils';

import { ItemCardComponent } from '../item-card/item-card.component';
import { ProviderSettingsService } from '../../services/provider-settings.service';

@Component({
  selector: 'app-item-list',
  imports: [FormsModule, RouterLink, ItemCardComponent],
  host: { '(keydown.escape)': 'closeFilters()' },
  template: `
    <div>
      <div class="flex items-center justify-between gap-4 mb-3 sm:mb-4">
        <h1 class="page-title">Library</h1>
        @if (visibleLibraryCount() > 0) {
          <a [routerLink]="['/items/add']" class="btn btn-primary shrink-0">Add title</a>
        }
      </div>

      @if (visibleLibraryCount() > 0) {
        <div class="flex items-center gap-2 mb-3">
          <input
            type="text"
            placeholder="Search by name..."
            aria-label="Search by name"
            [ngModel]="searchFilter()"
            (ngModelChange)="searchFilter.set($event)"
            class="form-select flex-1 min-w-0 text-base md:text-sm"
          />
          <button
            #filterToggle
            type="button"
            (click)="filtersOpen.set(!filtersOpen())"
            [attr.aria-expanded]="filtersOpen()"
            aria-controls="library-filters"
            class="btn btn-secondary shrink-0 md:hidden"
          >
            Filter &amp; sort
            @if (activeFilters().length > 0) {
              <span
                class="inline-flex size-5 items-center justify-center rounded-full bg-accent-primary text-xs text-white"
                [attr.aria-label]="activeFilters().length + ' applied'"
                >{{ activeFilters().length }}</span
              >
            }
          </button>
        </div>

        <div
          id="library-filters"
          class="flex flex-col gap-3 md:gap-2 mb-3 max-md:card max-md:p-3"
          [class.max-md:hidden]="!filtersOpen()"
        >
          <div
            role="group"
            aria-labelledby="status-filter-label"
            class="flex flex-wrap items-center gap-2"
          >
            <span id="status-filter-label" class="filter-label">Status</span>
            <button
              type="button"
              (click)="statusFilter.set('all')"
              [attr.aria-pressed]="statusFilter() === 'all'"
              class="chip"
            >
              All
            </button>
            @for (status of itemStatuses; track status) {
              <button
                type="button"
                (click)="statusFilter.set(status)"
                [attr.aria-pressed]="statusFilter() === status"
                class="chip"
              >
                {{ itemStatusLabels[status] }}
              </button>
            }
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-3 md:justify-between">
            <div
              role="group"
              aria-labelledby="type-filter-label"
              class="flex flex-wrap items-center gap-2"
            >
              <span id="type-filter-label" class="filter-label">Type</span>
              <button
                type="button"
                (click)="typeFilter.set('all')"
                [attr.aria-pressed]="typeFilter() === 'all'"
                class="chip"
              >
                All
              </button>
              @for (type of itemTypes; track type) {
                <button
                  type="button"
                  (click)="typeFilter.set(type)"
                  [attr.aria-pressed]="typeFilter() === type"
                  class="chip"
                >
                  {{ itemTypeLabels[type] }}
                </button>
              }
            </div>
            <div class="flex flex-wrap items-center gap-2 max-md:w-full">
              <select
                [ngModel]="groupFilter()"
                (ngModelChange)="groupFilter.set($event)"
                aria-label="Filter by group"
                class="form-select max-md:w-full md:max-w-56"
              >
                <option value="">All groups</option>
                @for (group of groups(); track group.id) {
                  <option [value]="group.id">{{ group.name }}</option>
                }
              </select>
              <select
                [ngModel]="sortValue()"
                (ngModelChange)="setSort($event)"
                aria-label="Sort by"
                class="form-select max-md:w-full"
              >
                @for (option of sortOptions; track option.label) {
                  <option [value]="option.field + ':' + option.direction">
                    {{ option.label }}
                  </option>
                }
              </select>
            </div>
          </div>
          <button type="button" (click)="closeFilters()" class="btn btn-primary w-full md:hidden">
            Show {{ filteredItems().length }}
            {{ filteredItems().length === 1 ? 'title' : 'titles' }}
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4 min-h-6 text-sm">
          <div class="flex flex-wrap items-baseline gap-x-3 max-md:w-full">
            <span
              aria-live="polite"
              class="text-light-font-secondary dark:text-dark-font-secondary"
              >{{ resultSummary() }}</span
            >
            <span class="meta md:hidden">{{ sortSummary() }}</span>
          </div>
          @if (!filtersOpen()) {
            @for (filter of activeFilters(); track filter.key) {
              <button
                type="button"
                (click)="clearFilter(filter.key)"
                [attr.aria-label]="'Remove filter: ' + filter.label"
                class="md:hidden inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full border border-light-border dark:border-dark-border bg-light-bg-secondary dark:bg-dark-bg-secondary font-medium cursor-pointer"
              >
                {{ filter.label }} <span aria-hidden="true">×</span>
              </button>
            }
          }
          @if (hasActiveFilters() && filteredItems().length > 0) {
            <button
              type="button"
              (click)="resetFilters()"
              class="text-accent-text underline cursor-pointer max-md:min-h-11"
            >
              Reset filters
            </button>
          }
        </div>
      }

      @if (filteredItems().length > 0) {
        <div
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6 items-start"
        >
          @for (item of filteredItems(); track item.id) {
            <app-item-card [item]="item" />
          }
        </div>
      } @else if (visibleLibraryCount() === 0) {
        <div class="card max-w-2xl mx-auto p-6 sm:p-8 text-center">
          <h2 class="section-title mb-2">Your library is empty</h2>
          <p class="mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">
            Add a series or movie to start tracking it.
          </p>
          <a [routerLink]="['/items/add']" class="btn btn-primary">Add title</a>
        </div>
      } @else {
        <div class="card max-w-2xl mx-auto p-6 sm:p-8 text-center">
          <h2 class="section-title mb-2">No matches</h2>
          <p class="mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">
            No titles fit your search and filters.
          </p>
          <button type="button" (click)="resetFilters()" class="btn btn-secondary">
            Clear search and filters
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .filter-label {
      flex-shrink: 0;
      font-size: 0.875rem;
      font-weight: 600;
    }
    @media (max-width: 47.99rem) {
      .filter-label {
        width: 100%;
      }
    }
    @media (min-width: 48rem) {
      .filter-label {
        width: 3.25rem;
      }
    }
  `,
})
export class ItemListComponent {
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);
  private itemSortService = inject(ItemSortService);
  private providerSettings = inject(ProviderSettingsService);

  readonly groups = this.groupService.groups;
  readonly itemStatuses = ITEM_STATUSES;
  readonly itemStatusLabels = ITEM_STATUS_LABELS;
  readonly itemTypes = ITEM_TYPES;
  readonly itemTypeLabels = ITEM_TYPE_LABELS;

  readonly sortOptions = SORT_OPTIONS;

  statusFilter = signal<FilterStatus>('all');
  typeFilter = signal<FilterType>('all');
  searchFilter = signal<string>('');
  groupFilter = signal<string>('');

  sortField = this.itemSortService.field;
  sortDirection = this.itemSortService.direction;

  allItems = this.watchListService.items;

  readonly filtersOpen = signal(false);
  private readonly filterToggle = viewChild<ElementRef<HTMLElement>>('filterToggle');
  readonly sortValue = computed(() => `${this.sortField()}:${this.sortDirection()}`);
  readonly sortSummary = computed(() => sortLabel(this.sortField(), this.sortDirection()));
  // Search stays visible, so only the controls a closed mobile panel hides are summarised.
  readonly activeFilters = computed(() => {
    const status = this.statusFilter();
    const type = this.typeFilter();
    const group = this.groupFilter();
    return [
      ...(status === 'all'
        ? []
        : [{ key: 'status' as const, label: this.itemStatusLabels[status] }]),
      ...(type === 'all' ? [] : [{ key: 'type' as const, label: this.itemTypeLabels[type] }]),
      ...(group
        ? [
            {
              key: 'group' as const,
              label: this.groups().find(({ id }) => id === group)?.name ?? 'Group',
            },
          ]
        : []),
    ];
  });
  readonly hasActiveFilters = computed(
    () => this.activeFilters().length > 0 || !!this.searchFilter().trim(),
  );

  private readonly visibleLibrary = computed(() =>
    this.providerSettings.settings().adultDisplayMode === 'hide'
      ? this.allItems().filter((item) => !item.isAdult)
      : this.allItems(),
  );
  readonly visibleLibraryCount = computed(() => this.visibleLibrary().length);
  readonly resultSummary = computed(() => {
    const total = this.visibleLibraryCount();
    const shown = this.filteredItems().length;
    const titles = total === 1 ? 'title' : 'titles';
    return this.hasActiveFilters()
      ? `Showing ${shown} of ${total} ${titles}`
      : `${total} ${titles}`;
  });

  resetFilters(): void {
    this.statusFilter.set('all');
    this.typeFilter.set('all');
    this.groupFilter.set('');
    this.searchFilter.set('');
  }

  clearFilter(key: 'status' | 'type' | 'group'): void {
    if (key === 'status') this.statusFilter.set('all');
    else if (key === 'type') this.typeFilter.set('all');
    else this.groupFilter.set('');
  }

  closeFilters(): void {
    if (!this.filtersOpen()) return;
    this.filtersOpen.set(false);
    this.filterToggle()?.nativeElement.focus();
  }

  setSort(value: string): void {
    const [field, direction] = value.split(':');
    if (isSortField(field)) this.setSortField(field);
    if (isSortDirection(direction)) this.setSortDirection(direction);
  }

  setSortField(field: SortField): void {
    this.itemSortService.setField(field);
  }

  setSortDirection(direction: SortDirection): void {
    this.itemSortService.setDirection(direction);
  }

  filteredItems = computed(() => {
    let items = this.visibleLibrary();
    const statusFilter = this.statusFilter();
    const typeFilter = this.typeFilter();
    const search = this.searchFilter().toLowerCase();
    const groupFilter = this.groupFilter();
    const sortField = this.sortField();
    const sortDirection = this.sortDirection();

    if (search) {
      items = items.filter((item) => item.title.toLowerCase().includes(search));
    }

    if (statusFilter !== 'all') {
      items = items.filter((item) => item.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      items = items.filter((item) => item.type === typeFilter);
    }

    if (groupFilter) {
      items = items.filter((item) => item.groupId === groupFilter);
    }

    return sortItems(items, sortField, sortDirection);
  });
}
