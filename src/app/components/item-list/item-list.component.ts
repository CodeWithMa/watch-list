import { Component, computed, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { Item } from '../../models/item.model';
import { ItemCardComponent } from '../item-card/item-card.component';

@Component({
  selector: 'app-item-list',
  imports: [FormsModule, RouterLink, ItemCardComponent],
  template: `
    <div class="max-w-[1200px] mx-auto p-8">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-2xl m-0 text-light-font dark:text-dark-font">All Items</h1>
        <a [routerLink]="['/items/add']" class="px-6 py-3 bg-accent-primary text-white no-underline rounded font-medium hover:bg-accent-primary-hover">Add Item</a>
      </div>
    
      <div class="flex gap-4 mb-8 p-4 bg-light-bg-primary dark:bg-dark-bg-primary rounded">
        <input type="text" placeholder="Search by name..." [ngModel]="searchFilter()" (ngModelChange)="searchFilter.set($event)" 
          class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font" />
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
      </div>
    
      <div class="flex flex-col gap-6">
        @for (group of groups(); track group.id) {
          <div class="border border-light-border dark:border-dark-border rounded overflow-hidden">
            <div role="button" tabindex="0" class="flex items-center gap-4 p-4 bg-light-bg-tertiary dark:bg-dark-bg-tertiary cursor-pointer select-none hover:bg-light-hover dark:hover:bg-dark-hover"
              (click)="toggleGroup(group.id)"
              (keydown.enter)="toggleGroup(group.id)"
              (keydown.space)="toggleGroup(group.id)">
              <h2 class="m-0 text-xl flex-1">{{ group.name }}</h2>
              <span class="text-sm text-light-font-secondary dark:text-dark-font-secondary">{{ isGroupExpanded(group.id) ? '▼' : '▶' }}</span>
              <span class="text-light-font-secondary dark:text-dark-font-secondary text-sm">({{ (groupedItems()[group.id] || []).length }})</span>
            </div>
            @if (isGroupExpanded(group.id)) {
              <div class="p-4">
                @for (item of groupedItems()[group.id] || []; track item.id) {
                  <app-item-card
                    [item]="item"
                    (markWatched)="markWatched(item.id)"
                    (markCompleted)="markCompleted(item.id)"
                    />
                }
                @if ((groupedItems()[group.id] || []).length === 0) {
                  <p class="text-center text-light-font-muted dark:text-dark-font-muted p-8">
                    No items in this group
                  </p>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
    `
})
export class ItemListComponent {
  private storageService = inject(StorageService);
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);

  statusFilter = signal<string>('all');
  searchFilter = signal<string>('');
  expandedGroups = signal<Set<string>>(new Set());
  groups = computed(() => {
    // Trigger reactivity by accessing the storage signal
    this.storageService.getDataSignal()();
    return this.groupService.getAllGroups();
  });
  
  allItems = computed(() => {
    const data = this.storageService.getDataSignal()();
    return data ? Object.values(data.items) : [];
  });

  filteredItems = computed(() => {
    const items = this.allItems();
    const filter = this.statusFilter();
    const search = this.searchFilter().toLowerCase();
    
    let result = items;
    
    if (search) {
      result = result.filter(item => item.title.toLowerCase().includes(search));
    }
    
    if (filter !== 'all') {
      result = result.filter(item => item.status === filter);
    }
    
    return result;
  });

  groupedItems = computed(() => {
    const map: Record<string, Item[]> = {};
    for (const item of this.filteredItems()) {
      if (!map[item.groupId]) {
        map[item.groupId] = [];
      }
      map[item.groupId].push(item);
    }
    return map;
  });

  constructor() {
    // Expand all groups by default
    this.groups().forEach(group => {
      this.expandedGroups.update(set => new Set(set).add(group.id));
    });
  }

  toggleGroup(groupId: string): void {
    this.expandedGroups.update(set => {
      const newSet = new Set(set);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }

  isGroupExpanded(groupId: string): boolean {
    return this.expandedGroups().has(groupId);
  }

  markWatched(itemId: string): void {
    this.watchListService.markWatched(itemId);
  }

  markCompleted(itemId: string): void {
    this.watchListService.markCompleted(itemId);
  }
}

