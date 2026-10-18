import { Injectable, inject, computed } from '@angular/core';
import { StorageService } from './storage.service';
import { Group } from '../models/group.model';
import { freezeReadModel } from '../models/readonly';
import { DEFAULT_GROUP_ID } from '../domain/item.constants';

@Injectable({
  providedIn: 'root',
})
export class GroupService {
  private storageService = inject(StorageService);

  groups = computed(() => {
    const data = this.storageService.getDataSignal()();
    return freezeReadModel(
      data ? Object.values(data.groups).sort((a, b) => a.order - b.order) : [],
    );
  });

  createGroup(name: string) {
    return this.storageService.mutate((data) => {
      const maxOrder = Math.max(-1, ...Object.values(data.groups).map((group) => group.order));
      const id = `group-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const group = { id, name, order: maxOrder + 1 };
      data.groups[id] = group;
      return group;
    });
  }

  updateGroup(group: Pick<Group, 'id' | 'name'>) {
    const { id, name } = group;
    return this.storageService.mutate((data) => {
      if (!Object.hasOwn(data.groups, id)) {
        throw new Error('This group no longer exists. Refresh the group list and try again.');
      }
      data.groups[id] = { ...data.groups[id], name };
    });
  }

  deleteGroup(groupId: string) {
    return this.storageService.mutate((data) => {
      if (groupId === DEFAULT_GROUP_ID) {
        throw new Error('Cannot delete the ungrouped group');
      }
      delete data.groups[groupId];
      // Group removal and item reassignment commit together.
      Object.values(data.items).forEach((item) => {
        if (item.groupId === groupId) item.groupId = DEFAULT_GROUP_ID;
      });
    });
  }

  reorderGroups(groupIds: string[]) {
    const ids = [...groupIds];
    return this.storageService.mutate((data) => {
      const groups = new Map<string, Group>();

      ids.forEach((id, index) => {
        const group = data.groups[id];
        if (Object.hasOwn(data.groups, id)) {
          groups.set(id, {
            ...group,
            order: index,
          });
        }
      });

      // Keep any groups not in the reorder list
      Object.values(data.groups).forEach((group) => {
        if (!groups.has(group.id)) {
          groups.set(group.id, group);
        }
      });

      data.groups = Object.fromEntries(groups);
    });
  }

  getGroupById(groupId: string) {
    return this.storageService.getGroups().find((group) => group.id === groupId);
  }
}
