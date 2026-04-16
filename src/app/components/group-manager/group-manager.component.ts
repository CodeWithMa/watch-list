import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GroupService } from '../../services/group.service';
import { Group } from '../../models/group.model';

@Component({
  selector: 'app-group-manager',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-[800px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Group Management</h1>

      <div class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg mb-8">
        <h2 class="text-xl mb-4 text-light-font-secondary dark:text-dark-font-secondary">Create New Group</h2>
        <form (ngSubmit)="createGroup()" class="flex gap-4">
          <input 
            type="text" 
            [(ngModel)]="newGroupName" 
            name="newGroupName"
            placeholder="Group name"
            required
            class="flex-1 p-3 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font"
          />
          <button type="submit" class="px-6 py-3 bg-accent-primary text-white border-none rounded cursor-pointer font-medium hover:bg-accent-primary-hover">Create Group</button>
        </form>
      </div>

      <div class="bg-light-bg-secondary dark:bg-dark-bg-secondary border border-light-border dark:border-dark-border rounded-lg p-6">
        <h2 class="text-xl mb-4 text-light-font-secondary dark:text-dark-font-secondary">Groups</h2>
        <div *ngFor="let group of sortedGroups(); let i = index" class="flex justify-between items-center p-4 border-b border-light-border-light dark:border-dark-border-light last:border-b-0">
          <div class="flex flex-col gap-1">
            <span class="font-medium text-lg">{{ group.name }}</span>
            <span class="text-sm text-light-font-secondary dark:text-dark-font-secondary">Order: {{ group.order }}</span>
          </div>
          <div class="flex gap-2">
            <button 
              *ngIf="i > 0" 
              (click)="moveUp(group.id)" 
              class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
              title="Move up"
            >
              ↑
            </button>
            <button 
              *ngIf="i < sortedGroups().length - 1" 
              (click)="moveDown(group.id)" 
              class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
              title="Move down"
            >
              ↓
            </button>
            <button 
              *ngIf="group.id !== 'ungrouped'"
              (click)="editGroup(group)" 
              class="px-4 py-2 border border-accent-warning rounded bg-accent-warning text-black dark:text-white hover:bg-accent-warning-hover cursor-pointer text-sm"
            >
              Edit
            </button>
            <button 
              *ngIf="group.id !== 'ungrouped'"
              (click)="deleteGroup(group.id)" 
              class="px-4 py-2 border border-accent-danger rounded bg-accent-danger text-white hover:bg-accent-danger-hover cursor-pointer text-sm"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div *ngIf="editingGroup()" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
        <div class="bg-light-bg-secondary dark:bg-dark-bg-secondary p-8 rounded-lg min-w-[400px]">
          <h3 class="mt-0 mb-6">Edit Group</h3>
          <form (ngSubmit)="saveEdit()">
            <input 
              type="text" 
              [(ngModel)]="editGroupName" 
              name="editGroupName"
              required
              class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font"
            />
            <div class="flex gap-4 mt-6">
              <button type="submit" class="px-6 py-3 bg-accent-primary text-white border-none rounded cursor-pointer hover:bg-accent-primary-hover">Save</button>
              <button type="button" (click)="cancelEdit()" class="px-6 py-3 bg-accent-secondary text-white border-none rounded cursor-pointer hover:bg-accent-secondary-hover">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
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

