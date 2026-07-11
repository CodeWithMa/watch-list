import { Component, computed, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';

import { ItemCardComponent } from '../item-card/item-card.component';

@Component({
  selector: 'app-item-list',
  imports: [FormsModule, RouterLink, ItemCardComponent],
  template: `
    <div class="max-w-[1200px] mx-auto p-8">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-2xl m-0 text-light-font dark:text-dark-font">All Items</h1>
        <div class="flex gap-4">
          <select [ngModel]="groupFilter()" (ngModelChange)="groupFilter.set($event)"
            class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font">
            <option value="">All Groups</option>
            @for (group of groups(); track group.id) {
              <option [value]="group.id">{{ group.name }}</option>
            }
          </select>
          <input type="text" placeholder="Search by name..." [ngModel]="searchFilter()" (ngModelChange)="searchFilter.set($event)"
            class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font w-64" />
          <a [routerLink]="['/items/add']" class="px-6 py-3 bg-accent-primary text-white no-underline rounded font-medium hover:bg-accent-primary-hover">Add Item</a>
        </div>
      </div>

      <div class="flex gap-4 mb-8 p-4 bg-light-bg-primary dark:bg-dark-bg-primary rounded">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="statusFilter" value="all" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" />
          All
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="statusFilter" value="not-started" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" />
          Not Started
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="statusFilter" value="in-progress" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" />
          In Progress
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="statusFilter" value="completed" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" />
          Completed
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="statusFilter" value="dropped" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" />
          Dropped
        </label>
      </div>

      <div class="flex flex-col gap-4">
        @for (item of filteredItems(); track item.id) {
          <app-item-card
            [item]="item"
            (markWatched)="markWatched(item.id)"
            (markCompleted)="markCompleted(item.id)"
            (markDropped)="markDropped(item.id)"
            />
        } @empty {
          <p class="text-center text-light-font-muted dark:text-dark-font-muted p-8">
            No items found
          </p>
        }
      </div>
    </div>
  `
})
export class ItemListComponent {
  private storageService = inject(StorageService);
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);

  readonly groups = this.groupService.groups;

  statusFilter = signal<string>('all');
  searchFilter = signal<string>('');
  groupFilter = signal<string>('');

  allItems = computed(() => {
    const data = this.storageService.getDataSignal()();
    return data ? Object.values(data.items) : [];
  });

  filteredItems = computed(() => {
    let items = this.allItems();
    const statusFilter = this.statusFilter();
    const search = this.searchFilter().toLowerCase();
    const groupFilter = this.groupFilter();

    if (search) {
      items = items.filter(item => item.title.toLowerCase().includes(search));
    }

    if (statusFilter !== 'all') {
      items = items.filter(item => item.status === statusFilter);
    }

    if (groupFilter) {
      items = items.filter(item => item.groupId === groupFilter);
    }

    return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  markWatched(itemId: string): void {
    this.watchListService.markWatched(itemId);
  }

  markCompleted(itemId: string): void {
    this.watchListService.markCompleted(itemId);
  }

  markDropped(itemId: string): void {
    this.watchListService.markDropped(itemId);
  }
}
