import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { Item, ItemStatus } from '../../models/item.model';
import { Group } from '../../models/group.model';
import { ItemCardComponent } from '../item-card/item-card.component';

@Component({
  selector: 'app-item-list',
  imports: [CommonModule, FormsModule, RouterLink, ItemCardComponent],
  template: `
    <div class="item-list-container">
      <div class="header">
        <h1>All Items</h1>
        <a [routerLink]="['/items/add']" class="add-button">Add Item</a>
      </div>

      <div class="filters">
        <label>
          <input 
            type="radio" 
            name="statusFilter" 
            value="all" 
            [(ngModel)]="statusFilter"
            (change)="updateFilter()"
          />
          All
        </label>
        <label>
          <input 
            type="radio" 
            name="statusFilter" 
            value="not-started" 
            [(ngModel)]="statusFilter"
            (change)="updateFilter()"
          />
          Not Started
        </label>
        <label>
          <input 
            type="radio" 
            name="statusFilter" 
            value="in-progress" 
            [(ngModel)]="statusFilter"
            (change)="updateFilter()"
          />
          In Progress
        </label>
        <label>
          <input 
            type="radio" 
            name="statusFilter" 
            value="completed" 
            [(ngModel)]="statusFilter"
            (change)="updateFilter()"
          />
          Completed
        </label>
      </div>

      <div class="groups-container">
        <div *ngFor="let group of groups()" class="group-section">
          <div class="group-header" (click)="toggleGroup(group.id)">
            <h2>{{ group.name }}</h2>
            <span class="toggle-icon">{{ isGroupExpanded(group.id) ? '▼' : '▶' }}</span>
            <span class="item-count">({{ getGroupItems(group.id).length }})</span>
          </div>
          
          <div *ngIf="isGroupExpanded(group.id)" class="group-items">
            <app-item-card
              *ngFor="let item of getGroupItems(group.id)"
              [item]="item"
              (onMarkWatched)="markWatched(item.id)"
              (onMarkCompleted)="markCompleted(item.id)"
            />
            <p *ngIf="getGroupItems(group.id).length === 0" class="empty-group">
              No items in this group
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .item-list-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    h1 {
      font-size: 2rem;
      margin: 0;
      color: light-dark(var(--light-font-color), var(--dark-font-color));
    }

    .add-button {
      padding: 0.75rem 1.5rem;
      background: var(--accent-primary);
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
    }

    .add-button:hover {
      background: var(--accent-primary-hover);
    }

    .filters {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      padding: 1rem;
      background: light-dark(var(--light-bg-primary), var(--dark-bg-primary));
      border-radius: 4px;
    }

    .filters label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .groups-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .group-section {
      border: 1px solid light-dark(var(--light-border-color), var(--dark-border-color));
      border-radius: 8px;
      overflow: hidden;
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: light-dark(var(--light-bg-tertiary), var(--dark-bg-tertiary));
      cursor: pointer;
      user-select: none;
    }

    .group-header:hover {
      background: light-dark(#e9ecef, #333333);
    }

    .group-header h2 {
      margin: 0;
      font-size: 1.3rem;
      flex: 1;
    }

    .toggle-icon {
      font-size: 0.8rem;
      color: light-dark(var(--light-font-secondary), var(--dark-font-secondary));
    }

    .item-count {
      color: light-dark(var(--light-font-secondary), var(--dark-font-secondary));
      font-size: 0.9rem;
    }

    .group-items {
      padding: 1rem;
    }

    .empty-group {
      text-align: center;
      color: light-dark(var(--light-font-muted), var(--dark-font-muted));
      padding: 2rem;
    }
  `]
})
export class ItemListComponent {
  statusFilter = signal<string>('all');
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
    
    if (filter === 'all') {
      return items;
    }
    
    return items.filter(item => item.status === filter);
  });

  constructor(
    private storageService: StorageService,
    private watchListService: WatchListService,
    private groupService: GroupService
  ) {
    // Expand all groups by default
    this.groups().forEach(group => {
      this.expandedGroups.update(set => new Set(set).add(group.id));
    });
  }

  updateFilter(): void {
    // Filter update is handled by computed signal
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

  getGroupItems(groupId: string): Item[] {
    return this.filteredItems().filter(item => item.groupId === groupId);
  }

  markWatched(itemId: string): void {
    this.watchListService.markWatched(itemId);
  }

  markCompleted(itemId: string): void {
    this.watchListService.markCompleted(itemId);
  }
}

