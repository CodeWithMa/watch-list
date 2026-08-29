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
import { statusButtonClass, FilterStatus } from '../../utils/status.utils';
import { typeButtonClass, FilterType } from '../../utils/type.utils';
import {
  SORT_DIRECTIONS,
  SORT_DIRECTION_LABELS,
  SORT_FIELDS,
  SORT_FIELD_LABELS,
  SortDirection,
  SortField,
  sortItems,
} from '../../utils/sort.utils';

import { ItemCardComponent } from '../item-card/item-card.component';

@Component({
  selector: 'app-item-list',
  imports: [FormsModule, RouterLink, ItemCardComponent],
  template: `
    <div>
      <div class="flex justify-between items-center mb-8 gap-4 flex-wrap">
        <h1 class="text-2xl m-0 text-light-font dark:text-dark-font">All Items</h1>
        <div class="flex gap-4 flex-wrap items-center">
          <div class="flex items-center gap-2">
            <select
              [ngModel]="sortField()"
              (ngModelChange)="setSortField($event)"
              aria-label="Sort by"
              class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font"
            >
              @for (field of sortFields; track field) {
                <option [value]="field">{{ sortFieldLabels[field] }}</option>
              }
            </select>
            <button
              type="button"
              (click)="toggleSortDirection()"
              [attr.aria-label]="'Sort direction: ' + sortDirectionLabels[sortDirection()]"
              [attr.title]="sortDirectionLabels[sortDirection()]"
              class="px-3 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary flex items-center justify-center"
            >
              @if (sortDirection() === 'desc') {
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
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
                  width="20"
                  height="20"
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
            </button>
          </div>
          <select
            [ngModel]="groupFilter()"
            (ngModelChange)="groupFilter.set($event)"
            class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font"
          >
            <option value="">All Groups</option>
            @for (group of groups(); track group.id) {
              <option [value]="group.id">{{ group.name }}</option>
            }
          </select>
          <input
            type="text"
            placeholder="Search by name..."
            [ngModel]="searchFilter()"
            (ngModelChange)="searchFilter.set($event)"
            class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font w-64"
          />
          <a
            [routerLink]="['/items/add']"
            class="px-6 py-3 bg-accent-primary text-white no-underline rounded font-medium hover:bg-accent-primary-hover"
            >Add Item</a
          >
        </div>
      </div>

      <div class="flex flex-col gap-2 mb-4">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            (click)="statusFilter.set('all')"
            [class]="getFilterButtonClass('all')"
          >
            All
          </button>
          @for (status of itemStatuses; track status) {
            <button
              type="button"
              (click)="statusFilter.set(status)"
              [class]="getFilterButtonClass(status)"
            >
              {{ itemStatusLabels[status] }}
            </button>
          }
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            (click)="typeFilter.set('all')"
            [class]="getTypeFilterButtonClass('all')"
          >
            All
          </button>
          @for (type of itemTypes; track type) {
            <button
              type="button"
              (click)="typeFilter.set(type)"
              [class]="getTypeFilterButtonClass(type)"
            >
              {{ itemTypeLabels[type] }}
            </button>
          }
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        @for (item of filteredItems(); track item.id) {
          <app-item-card [item]="item" />
        } @empty {
          <p class="text-center text-light-font-muted dark:text-dark-font-muted p-8">
            No items found
          </p>
        }
      </div>
    </div>
  `,
})
export class ItemListComponent {
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);
  private itemSortService = inject(ItemSortService);

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

  getFilterButtonClass(status: FilterStatus): string {
    return statusButtonClass(this.statusFilter() === status, status);
  }

  getTypeFilterButtonClass(type: FilterType): string {
    return typeButtonClass(this.typeFilter() === type, type);
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
    let items = this.allItems();
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
