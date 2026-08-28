import { Component, computed, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { ITEM_STATUSES, ITEM_STATUS_LABELS } from '../../domain/item.constants';
import { statusButtonClass, FilterStatus } from '../../utils/status.utils';

import { ItemCardComponent } from '../item-card/item-card.component';

@Component({
  selector: 'app-item-list',
  imports: [FormsModule, RouterLink, ItemCardComponent],
  template: `
    <div>
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-2xl m-0 text-light-font dark:text-dark-font">All Items</h1>
        <div class="flex gap-4">
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

      <div
        class="flex flex-wrap gap-3 mb-8 p-4 bg-light-bg-primary dark:bg-dark-bg-primary rounded"
      >
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

  readonly groups = this.groupService.groups;
  readonly itemStatuses = ITEM_STATUSES;
  readonly itemStatusLabels = ITEM_STATUS_LABELS;

  statusFilter = signal<FilterStatus>('all');
  searchFilter = signal<string>('');
  groupFilter = signal<string>('');

  allItems = this.watchListService.items;

  getFilterButtonClass(status: FilterStatus): string {
    return statusButtonClass(this.statusFilter() === status, status);
  }

  filteredItems = computed(() => {
    let items = this.allItems();
    const statusFilter = this.statusFilter();
    const search = this.searchFilter().toLowerCase();
    const groupFilter = this.groupFilter();

    if (search) {
      items = items.filter((item) => item.title.toLowerCase().includes(search));
    }

    if (statusFilter !== 'all') {
      items = items.filter((item) => item.status === statusFilter);
    }

    if (groupFilter) {
      items = items.filter((item) => item.groupId === groupFilter);
    }

    return [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  });
}
