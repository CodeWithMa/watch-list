import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { Group } from '../models/group.model';
import { WatchListService } from './watch-list.service';

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  constructor(
    private storageService: StorageService,
    private watchListService: WatchListService
  ) {}

  createGroup(name: string): Group {
    const data = this.storageService.getData();
    const groups = this.storageService.getGroups();
    const maxOrder = groups.length > 0 ? Math.max(...groups.map(g => g.order)) : -1;
    
    const id = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newGroup: Group = {
      id,
      name,
      order: maxOrder + 1
    };

    this.storageService.saveData({
      ...data,
      groups: {
        ...data.groups,
        [id]: newGroup
      }
    });

    return newGroup;
  }

  updateGroup(group: Group): void {
    const data = this.storageService.getData();
    this.storageService.saveData({
      ...data,
      groups: {
        ...data.groups,
        [group.id]: group
      }
    });
  }

  deleteGroup(groupId: string): void {
    if (groupId === 'ungrouped') {
      throw new Error('Cannot delete the ungrouped group');
    }

    const data = this.storageService.getData();
    const { [groupId]: removed, ...groups } = data.groups;

    // Move all items from this group to ungrouped
    const items = { ...data.items };
    Object.values(items).forEach(item => {
      if (item.groupId === groupId) {
        items[item.id] = {
          ...item,
          groupId: 'ungrouped'
        };
      }
    });

    this.storageService.saveData({
      ...data,
      groups,
      items
    });
  }

  reorderGroups(groupIds: string[]): void {
    const data = this.storageService.getData();
    const groups: Record<string, Group> = {};

    groupIds.forEach((id, index) => {
      const group = data.groups[id];
      if (group) {
        groups[id] = {
          ...group,
          order: index
        };
      }
    });

    // Keep any groups not in the reorder list
    Object.values(data.groups).forEach(group => {
      if (!groups[group.id]) {
        groups[group.id] = group;
      }
    });

    this.storageService.saveData({
      ...data,
      groups
    });
  }

  getGroupById(groupId: string): Group | undefined {
    const data = this.storageService.getData();
    return data.groups[groupId];
  }

  getAllGroups(): Group[] {
    return this.storageService.getGroups();
  }
}

