import { Component, OnInit, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { GroupService } from '../../services/group.service';
import { Group } from '../../models/group.model';
import { createAsyncAction, withAsyncAction } from '../../utils/async-action';

@Component({
  selector: 'app-group-manager',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="group-manager-container">
      <h1>Group Management</h1>

      <div *ngIf="state.error()" class="message" [class.error-message]="!state.error()?.includes('success')" [class.success-message]="state.error()?.includes('success')">
        {{ state.error() }}
      </div>

      <div class="create-group-section">
        <h2>Create New Group</h2>
        <form (ngSubmit)="createGroup()" class="create-form">
          <input 
            type="text" 
            [(ngModel)]="newGroupName" 
            name="newGroupName"
            placeholder="Group name"
            required
            class="group-input"
            [disabled]="state.busy()"
          />
          <button type="submit" class="create-btn" [disabled]="state.busy()">Create Group</button>
        </form>
      </div>

      <div class="groups-list">
        <h2>Groups</h2>
        <div *ngFor="let group of sortedGroups(); let i = index" class="group-item">
          <div class="group-info">
            <span class="group-name">{{ group.name }}</span>
            <span class="group-order">Order: {{ group.order }}</span>
          </div>
          <div class="group-actions">
            <button 
              *ngIf="i > 0" 
              (click)="moveUp(group.id)" 
              class="action-btn"
              [disabled]="state.busy()"
              title="Move up"
            >
              ↑
            </button>
            <button 
              *ngIf="i < sortedGroups().length - 1" 
              (click)="moveDown(group.id)" 
              class="action-btn"
              title="Move down"
            >
              ↓
            </button>
            <button 
              *ngIf="group.id !== 'ungrouped'"
              (click)="editGroup(group)" 
              class="action-btn edit"
            >
              Edit
            </button>
            <button 
              *ngIf="group.id !== 'ungrouped'"
              (click)="deleteGroup(group.id)" 
              class="action-btn delete"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div *ngIf="editingGroup()" class="edit-modal">
        <div class="modal-content">
          <h3>Edit Group</h3>
          <form (ngSubmit)="saveEdit()">
            <input 
              type="text" 
              [(ngModel)]="editGroupName" 
              name="editGroupName"
              required
              class="group-input"
            />
            <div class="modal-actions">
              <button type="submit" class="save-btn" [disabled]="state.busy()">Save</button>
              <button type="button" (click)="cancelEdit()" class="cancel-btn">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .group-manager-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 2rem;
      color: light-dark(var(--light-font-color), var(--dark-font-color));
    }

    h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: light-dark(var(--light-font-secondary), var(--dark-font-secondary));
    }

    .create-group-section {
      background: light-dark(var(--light-bg-tertiary), var(--dark-bg-tertiary));
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
    }

    .create-form {
      display: flex;
      gap: 1rem;
    }

    .group-input {
      flex: 1;
      padding: 0.75rem;
      border: 1px solid light-dark(var(--light-border-color), var(--dark-border-color));
      border-radius: 4px;
      font-size: 1rem;
      background: light-dark(var(--light-bg-secondary), var(--dark-bg-secondary));
      color: light-dark(var(--light-font-color), var(--dark-font-color));
    }

    .create-btn {
      padding: 0.75rem 1.5rem;
      background: var(--accent-primary);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }

    .create-btn:hover {
      background: var(--accent-primary-hover);
    }

    .groups-list {
      background: light-dark(var(--light-bg-secondary), var(--dark-bg-secondary));
      border: 1px solid light-dark(var(--light-border-color), var(--dark-border-color));
      border-radius: 8px;
      padding: 1.5rem;
    }

    .group-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid light-dark(var(--light-border-light), var(--dark-border-light));
    }

    .group-item:last-child {
      border-bottom: none;
    }

    .group-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .group-name {
      font-weight: 500;
      font-size: 1.1rem;
    }

    .group-order {
      font-size: 0.9rem;
      color: light-dark(var(--light-font-secondary), var(--dark-font-secondary));
    }

    .group-actions {
      display: flex;
      gap: 0.5rem;
    }

    .action-btn {
      padding: 0.5rem 1rem;
      border: 1px solid light-dark(var(--light-border-color), var(--dark-border-color));
      border-radius: 4px;
      background: light-dark(var(--light-bg-secondary), var(--dark-bg-secondary));
      color: light-dark(var(--light-font-color), var(--dark-font-color));
      cursor: pointer;
      font-size: 0.9rem;
    }

    .action-btn:hover {
      background: light-dark(var(--light-bg-tertiary), var(--dark-bg-tertiary));
    }

    .action-btn.edit {
      background: var(--accent-warning);
      color: light-dark(#000, #fff);
      border-color: var(--accent-warning);
    }

    .action-btn.edit:hover {
      background: var(--accent-warning-hover);
    }

    .action-btn.delete {
      background: var(--accent-danger);
      color: white;
      border-color: var(--accent-danger);
    }

    .action-btn.delete:hover {
      background: var(--accent-danger-hover);
    }

    .edit-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: light-dark(var(--light-bg-secondary), var(--dark-bg-secondary));
      padding: 2rem;
      border-radius: 8px;
      min-width: 400px;
    }

    .modal-content h3 {
      margin-top: 0;
      margin-bottom: 1.5rem;
    }

    .modal-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
    }

    .save-btn {
      padding: 0.75rem 1.5rem;
      background: var(--accent-primary);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .save-btn:hover {
      background: var(--accent-primary-hover);
    }

    .cancel-btn {
      padding: 0.75rem 1.5rem;
      background: var(--accent-secondary);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .cancel-btn:hover {
      background: var(--accent-secondary-hover);
    }
  `]
})
export class GroupManagerComponent implements OnInit {
  private readonly storageService = inject(StorageService);
  private readonly groupService = inject(GroupService);

  state = createAsyncAction();
  groups = signal<Group[]>([]);
  editingGroup = signal<Group | null>(null);
  editGroupName = '';
  newGroupName = '';

  constructor() {
    effect(() => {
      const data = this.storageService.data();
      if (data) {
        this.loadGroups();
      }
    });
  }

  ngOnInit(): void {
  }

  loadGroups(): void {
    this.groups.set(this.groupService.getAllGroups());
  }

  sortedGroups() {
    return [...this.groups()].sort((a, b) => a.order - b.order);
  }

  async createGroup(): Promise<void> {
    if (!this.newGroupName.trim()) {
      return;
    }
    await withAsyncAction(
      async () => {
        await this.groupService.createGroup(this.newGroupName.trim());
        this.newGroupName = '';
      },
      this.state
    )();
  }

  editGroup(group: Group): void {
    this.editingGroup.set(group);
    this.editGroupName = group.name;
  }

  async saveEdit(): Promise<void> {
    const group = this.editingGroup();
    if (group && this.editGroupName.trim()) {
      await withAsyncAction(
        async () => {
          await this.groupService.updateGroup({
            ...group,
            name: this.editGroupName.trim()
          });
          this.cancelEdit();
        },
        this.state
      )();
    }
  }

  cancelEdit(): void {
    this.editingGroup.set(null);
    this.editGroupName = '';
  }

  async deleteGroup(groupId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this group? Items will be moved to "Ungrouped".')) {
      return;
    }
    await withAsyncAction(
      async () => {
        await this.groupService.deleteGroup(groupId);
      },
      this.state
    )();
  }

  async moveUp(groupId: string): Promise<void> {
    const sorted = this.sortedGroups();
    const index = sorted.findIndex(g => g.id === groupId);
    if (index > 0) {
      const groupIds = sorted.map(g => g.id);
      [groupIds[index], groupIds[index - 1]] = [groupIds[index - 1], groupIds[index]];
      await withAsyncAction(
        async () => {
          await this.groupService.reorderGroups(groupIds);
        },
        this.state
      )();
    }
  }

  async moveDown(groupId: string): Promise<void> {
    const sorted = this.sortedGroups();
    const index = sorted.findIndex(g => g.id === groupId);
    if (index < sorted.length - 1) {
      const groupIds = sorted.map(g => g.id);
      [groupIds[index], groupIds[index + 1]] = [groupIds[index + 1], groupIds[index]];
      await withAsyncAction(
        async () => {
          await this.groupService.reorderGroups(groupIds);
        },
        this.state
      )();
    }
  }
}

