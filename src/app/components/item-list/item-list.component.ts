import { Component, computed, signal, inject } from '@angular/core';
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
  SORT_DIRECTIONS,
  SORT_DIRECTION_LABELS,
  SORT_FIELDS,
  SORT_FIELD_LABELS,
  SortDirection,
  SortField,
  sortItems,
  sortOrderLabel,
} from '../../utils/sort.utils';

import { ItemCardComponent } from '../item-card/item-card.component';
import { ProviderSettingsService } from '../../services/provider-settings.service';

@Component({
  selector: 'app-item-list',
  imports: [FormsModule, RouterLink, ItemCardComponent],
  template: `
    <div>
      <div class="flex items-center justify-between gap-4 mb-3 sm:mb-4">
        <h1 class="page-title">All Items</h1>
        <a [routerLink]="['/items/add']" class="btn btn-primary shrink-0">Add Item</a>
      </div>

      <div class="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="text"
          placeholder="Search by name..."
          aria-label="Search by name"
          [ngModel]="searchFilter()"
          (ngModelChange)="searchFilter.set($event)"
          class="form-select flex-1 min-w-40 text-base md:text-sm"
        />
        <button
          type="button"
          (click)="filtersOpen.set(!filtersOpen())"
          [attr.aria-expanded]="filtersOpen()"
          aria-controls="library-filters"
          class="btn btn-secondary md:hidden"
        >
          Filter &amp; sort
          @if (secondaryFilterCount() > 0) {
            <span
              class="inline-flex size-5 items-center justify-center rounded-full bg-accent-primary text-xs text-white"
              [attr.aria-label]="secondaryFilterCount() + ' applied'"
              >{{ secondaryFilterCount() }}</span
            >
          }
        </button>
      </div>

      <div class="flex flex-col gap-2 mb-3">
        <div
          role="group"
          aria-labelledby="status-filter-label"
          class="relative flex items-center gap-2"
        >
          <span
            id="status-filter-label"
            class="max-md:sr-only w-12 shrink-0 text-sm font-medium text-light-font-secondary dark:text-dark-font-secondary"
            >Status</span
          >
          <div
            class="scroll-fade-x relative flex gap-2 overflow-x-auto max-md:-mx-4 max-md:px-4 py-0.5"
          >
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
        </div>
        <div
          id="library-filters"
          class="flex flex-wrap items-center gap-x-4 gap-y-2 md:justify-between max-md:p-3 max-md:rounded max-md:border max-md:border-light-border max-md:dark:border-dark-border"
          [class.max-md:hidden]="!filtersOpen()"
        >
          <div
            role="group"
            aria-labelledby="type-filter-label"
            class="flex flex-wrap items-center gap-2 max-md:w-full"
          >
            <span
              id="type-filter-label"
              class="max-md:w-full md:w-12 shrink-0 text-sm font-medium text-light-font-secondary dark:text-dark-font-secondary"
              >Type</span
            >
            <button
              type="button"
              (click)="typeFilter.set('all')"
              [attr.aria-pressed]="typeFilter() === 'all'"
              class="chip max-md:flex-1 max-md:shrink max-md:min-w-0 max-md:px-1"
            >
              All
            </button>
            @for (type of itemTypes; track type) {
              <button
                type="button"
                (click)="typeFilter.set(type)"
                [attr.aria-pressed]="typeFilter() === type"
                class="chip max-md:flex-1 max-md:shrink max-md:min-w-0 max-md:px-1"
              >
                {{ itemTypeLabels[type] }}
              </button>
            }
          </div>
          <div class="flex flex-wrap items-center gap-2 max-md:w-full">
            <div class="flex items-center gap-2 max-md:w-full">
              <select
                [ngModel]="sortField()"
                (ngModelChange)="setSortField($event)"
                aria-label="Sort by"
                class="form-select max-md:flex-1"
              >
                @for (field of sortFields; track field) {
                  <option [value]="field">{{ sortFieldLabels[field] }}</option>
                }
              </select>
              <button
                type="button"
                (click)="toggleSortDirection()"
                [attr.aria-label]="'Sort direction: ' + sortOrder()"
                [attr.title]="sortDirectionLabels[sortDirection()]"
                class="btn btn-secondary whitespace-nowrap"
              >
                @if (sortDirection() === 'desc') {
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 19V5" />
                    <path d="M5 12l7-7 7 7" />
                  </svg>
                } @else {
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14" />
                    <path d="M19 12l-7 7-7-7" />
                  </svg>
                }
                {{ sortOrder() }}
              </button>
            </div>
            <select
              [ngModel]="groupFilter()"
              (ngModelChange)="groupFilter.set($event)"
              aria-label="Filter by group"
              class="form-select max-md:w-full md:max-w-56"
            >
              <option value="">All Groups</option>
              @for (group of groups(); track group.id) {
                <option [value]="group.id">{{ group.name }}</option>
              }
            </select>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-3 mb-3 min-h-6 text-sm" aria-live="polite">
        <span class="text-light-font-secondary dark:text-dark-font-secondary">{{
          resultSummary()
        }}</span>
        @if (hasActiveFilters() && visibleLibraryCount() > 0) {
          <button
            type="button"
            (click)="resetFilters()"
            class="text-accent-text underline cursor-pointer max-md:min-h-11"
          >
            Reset filters
          </button>
        }
      </div>

      @if (filteredItems().length > 0) {
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          @for (item of filteredItems(); track item.id) {
            <app-item-card [item]="item" />
          }
        </div>
      } @else if (visibleLibraryCount() === 0) {
        <div class="card p-6 sm:p-8 text-center">
          <h2 class="section-title mb-2">Your library is empty</h2>
          <p class="mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">
            Add a series or movie to start tracking it.
          </p>
          <a [routerLink]="['/items/add']" class="btn btn-primary">Add your first title</a>
        </div>
      } @else {
        <div class="card p-6 sm:p-8 text-center">
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

  readonly sortFields = SORT_FIELDS;
  readonly sortDirections = SORT_DIRECTIONS;
  readonly sortFieldLabels = SORT_FIELD_LABELS;
  readonly sortDirectionLabels = SORT_DIRECTION_LABELS;

  statusFilter = signal<FilterStatus>('all');
  typeFilter = signal<FilterType>('all');
  searchFilter = signal<string>('');
  groupFilter = signal<string>('');

  sortField = this.itemSortService.field;
  sortDirection = this.itemSortService.direction;

  allItems = this.watchListService.items;

  readonly filtersOpen = signal(false);
  readonly sortOrder = computed(() => sortOrderLabel(this.sortField(), this.sortDirection()));
  readonly secondaryFilterCount = computed(
    () => Number(this.typeFilter() !== 'all') + Number(!!this.groupFilter()),
  );
  readonly hasActiveFilters = computed(
    () =>
      this.secondaryFilterCount() > 0 ||
      this.statusFilter() !== 'all' ||
      !!this.searchFilter().trim(),
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

  setSortField(field: SortField): void {
    this.itemSortService.setField(field);
  }

  setSortDirection(direction: SortDirection): void {
    this.itemSortService.setDirection(direction);
  }

  toggleSortDirection(): void {
    this.itemSortService.toggleDirection();
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
