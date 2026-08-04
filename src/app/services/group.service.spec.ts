import { TestBed } from '@angular/core/testing';
import { GroupService } from './group.service';
import { StorageService } from './storage.service';
import { IDBFactory } from 'fake-indexeddb';
import { Group } from '../models/group.model';
import { Item } from '../models/item.model';
import { DEFAULT_GROUP_ID } from '../domain/item.constants';

describe('GroupService', () => {
  let storageService: StorageService;
  let service: GroupService;

  beforeEach(async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: new IDBFactory(),
    });
    TestBed.configureTestingModule({});
    storageService = TestBed.inject(StorageService);
    await storageService.initialize();
    service = TestBed.inject(GroupService);
  });

  describe('groups', () => {
    it('is empty when there are no groups beside ungrouped', () => {
      expect(service.groups()).toEqual([{ id: 'ungrouped', name: 'Ungrouped', order: 0 }]);
    });

    it('returns groups sorted by order', () => {
      saveData({
        groups: {
          a: { id: 'a', name: 'A', order: 2 },
          b: { id: 'b', name: 'B', order: 0 },
          c: { id: 'c', name: 'C', order: 1 },
        },
      });

      expect(service.groups().map((g) => g.name)).toEqual(['Ungrouped', 'B', 'C', 'A']);
    });
  });

  describe('createGroup', () => {
    it('creates a group with the next order and persists it', () => {
      saveData({
        groups: {
          [DEFAULT_GROUP_ID]: { id: 'ungrouped', name: 'Ungrouped', order: 0 },
          existing: { id: 'existing', name: 'Existing', order: 0 },
        },
      });

      const created = service.createGroup('New Group');

      expect(created.name).toBe('New Group');
      expect(created.order).toBe(1);
      expect(created.id).toMatch(/^group-/);
      expect(storageService.getData().groups[created.id]).toEqual(created);
    });

    it('uses the next order when groups exist', () => {
      const created = service.createGroup('Solo');

      expect(created.order).toBe(1);
    });
  });

  describe('updateGroup', () => {
    it('updates an existing group', () => {
      const group: Group = { id: 'g1', name: 'Original', order: 1 };
      saveData({ groups: { [group.id]: group } });

      service.updateGroup({ ...group, name: 'Renamed' });

      expect(storageService.getData().groups['g1'].name).toBe('Renamed');
    });
  });

  describe('deleteGroup', () => {
    it('throws when trying to delete the ungrouped group', () => {
      expect(() => service.deleteGroup(DEFAULT_GROUP_ID)).toThrow(
        'Cannot delete the ungrouped group',
      );
    });

    it('removes the group and moves its items to ungrouped', () => {
      saveData({
        groups: {
          [DEFAULT_GROUP_ID]: { id: 'ungrouped', name: 'Ungrouped', order: 0 },
          films: { id: 'films', name: 'Films', order: 1 },
        },
        items: {
          inFilms: createItem({ id: 'inFilms', groupId: 'films' }),
          untouched: createItem({ id: 'untouched', groupId: 'ungrouped' }),
        },
      });

      service.deleteGroup('films');

      const data = storageService.getData();
      expect(data.groups['films']).toBeUndefined();
      expect(data.items['inFilms'].groupId).toBe(DEFAULT_GROUP_ID);
      expect(data.items['untouched'].groupId).toBe(DEFAULT_GROUP_ID);
    });
  });

  describe('reorderGroups', () => {
    it('reassigns order from the provided id list', () => {
      saveData({
        groups: {
          a: { id: 'a', name: 'A', order: 0 },
          b: { id: 'b', name: 'B', order: 1 },
          c: { id: 'c', name: 'C', order: 2 },
        },
      });

      service.reorderGroups(['c', 'a', 'b']);

      const groups = storageService.getData().groups;
      expect(groups['c'].order).toBe(0);
      expect(groups['a'].order).toBe(1);
      expect(groups['b'].order).toBe(2);
    });

    it('keeps groups not present in the reorder list', () => {
      saveData({
        groups: {
          a: { id: 'a', name: 'A', order: 0 },
          b: { id: 'b', name: 'B', order: 1 },
        },
      });

      service.reorderGroups(['a']);

      const groups = storageService.getData().groups;
      expect(groups['a'].order).toBe(0);
      expect(groups['b'].order).toBe(1);
    });
  });

  describe('getGroupById', () => {
    it('returns the matching group', () => {
      saveData({ groups: { g1: { id: 'g1', name: 'G1', order: 0 } } });

      expect(service.getGroupById('g1')?.name).toBe('G1');
    });

    it('returns undefined for an unknown group', () => {
      expect(service.getGroupById('missing')).toBeUndefined();
    });
  });

  function saveData(data?: Partial<ReturnType<StorageService['getData']>>): void {
    storageService.saveData({
      schemaVersion: 4,
      lastModifiedAt: '2026-04-01T10:00:00.000Z',
      groups: {
        [DEFAULT_GROUP_ID]: { id: 'ungrouped', name: 'Ungrouped', order: 0 },
        ...data?.groups,
      },
      items: data?.items ?? {},
      deletedItems: data?.deletedItems ?? {},
    });
  }

  function createItem(options: { id: string; groupId: string }): Item {
    return {
      id: options.id,
      title: 'Item',
      type: 'movie',
      groupId: options.groupId,
      status: 'not-started',
      watchHistory: [],
      createdAt: '2026-04-01T10:00:00.000Z',
    };
  }
});
