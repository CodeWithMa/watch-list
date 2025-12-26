import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GroupService } from '../../services/group.service';
import { Group } from '../../models/group.model';

@Component({
  selector: 'app-group-manager',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="group-manager-container">
      <h1>Group Management</h1>

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
          />
          <button type="submit" class="create-btn">Create Group</button>
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
              <button type="submit" class="save-btn">Save</button>
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
      color: #333;
    }

    h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: #555;
    }

    .create-group-section {
      background: #f8f9fa;
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
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }

    .create-btn {
      padding: 0.75rem 1.5rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }

    .create-btn:hover {
      background: #0056b3;
    }

    .groups-list {
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 1.5rem;
    }

    .group-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid #eee;
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
      color: #666;
    }

    .group-actions {
      display: flex;
      gap: 0.5rem;
    }

    .action-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .action-btn:hover {
      background: #f8f9fa;
    }

    .action-btn.edit {
      background: #ffc107;
      color: #000;
      border-color: #ffc107;
    }

    .action-btn.edit:hover {
      background: #e0a800;
    }

    .action-btn.delete {
      background: #dc3545;
      color: white;
      border-color: #dc3545;
    }

    .action-btn.delete:hover {
      background: #c82333;
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
      background: white;
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
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .save-btn:hover {
      background: #0056b3;
    }

    .cancel-btn {
      padding: 0.75rem 1.5rem;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .cancel-btn:hover {
      background: #5a6268;
    }
  `]
})
export class GroupManagerComponent implements OnInit {
  groups = signal<Group[]>([]);
  editingGroup = signal<Group | null>(null);
  editGroupName = '';
  newGroupName = '';

  constructor(private groupService: GroupService) {}

  ngOnInit(): void {
    this.loadGroups();
  }

  loadGroups(): void {
    this.groups.set(this.groupService.getAllGroups());
  }

  sortedGroups() {
    return [...this.groups()].sort((a, b) => a.order - b.order);
  }

  createGroup(): void {
    if (!this.newGroupName.trim()) {
      return;
    }
    this.groupService.createGroup(this.newGroupName.trim());
    this.newGroupName = '';
    this.loadGroups();
  }

  editGroup(group: Group): void {
    this.editingGroup.set(group);
    this.editGroupName = group.name;
  }

  saveEdit(): void {
    const group = this.editingGroup();
    if (group && this.editGroupName.trim()) {
      this.groupService.updateGroup({
        ...group,
        name: this.editGroupName.trim()
      });
      this.cancelEdit();
      this.loadGroups();
    }
  }

  cancelEdit(): void {
    this.editingGroup.set(null);
    this.editGroupName = '';
  }

  deleteGroup(groupId: string): void {
    if (confirm('Are you sure you want to delete this group? Items will be moved to "Ungrouped".')) {
      try {
        this.groupService.deleteGroup(groupId);
        this.loadGroups();
      } catch (error) {
        alert('Cannot delete the ungrouped group');
      }
    }
  }

  moveUp(groupId: string): void {
    const sorted = this.sortedGroups();
    const index = sorted.findIndex(g => g.id === groupId);
    if (index > 0) {
      const groupIds = sorted.map(g => g.id);
      [groupIds[index], groupIds[index - 1]] = [groupIds[index - 1], groupIds[index]];
      this.groupService.reorderGroups(groupIds);
      this.loadGroups();
    }
  }

  moveDown(groupId: string): void {
    const sorted = this.sortedGroups();
    const index = sorted.findIndex(g => g.id === groupId);
    if (index < sorted.length - 1) {
      const groupIds = sorted.map(g => g.id);
      [groupIds[index], groupIds[index + 1]] = [groupIds[index + 1], groupIds[index]];
      this.groupService.reorderGroups(groupIds);
      this.loadGroups();
    }
  }
}

