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

  async createGroup(name: string): Promise<Group> {
    const data = this.storageService.getData();
    const groups = this.storageService.getGroups();
    const maxOrder = groups.length > 0 ? Math.max(...groups.map(g => g.order)) : -1;
    
    const id = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newGroup: Group = {
      id,
      name,
      order: maxOrder + 1
    };

    await this.storageService.saveData({
      ...data,
      groups: {
        ...data.groups,
        [id]: newGroup
      }
    });

    return newGroup;
  }

  async updateGroup(group: Group): Promise<void> {
    const data = this.storageService.getData();
    await this.storageService.saveData({
      ...data,
      groups: {
        ...data.groups,
        [group.id]: group
      }
    });
  }

  async deleteGroup(groupId: string): Promise<void> {
    if (groupId === 'ungrouped') {
      throw new Error('Cannot delete the ungrouped group');
    }

    const data = this.storageService.getData();
    const { [groupId]: removed, ...groups } = data.groups;

    const items = { ...data.items };
    Object.values(items).forEach(item => {
      if (item.groupId === groupId) {
        items[item.id] = {
          ...item,
          groupId: 'ungrouped'
        };
      }
    });

    await this.storageService.saveData({
      ...data,
      groups,
      items
    });
  }

  async reorderGroups(groupIds: string[]): Promise<void> {
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

    Object.values(data.groups).forEach(group => {
      if (!groups[group.id]) {
        groups[group.id] = group;
      }
    });

    await this.storageService.saveData({
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

