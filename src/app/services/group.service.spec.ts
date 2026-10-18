import { TestBed } from '@angular/core/testing';
import { GroupService } from './group.service';
import { StorageService } from './storage.service';
import { IDBFactory } from 'fake-indexeddb';
import { Group } from '../models/group.model';
import { Item } from '../models/item.model';
import { CURRENT_SCHEMA_VERSION } from '../models/storage.model';
import { DEFAULT_GROUP_ID } from '../domain/item.constants';
import { vi } from 'vitest';
import { controlStorageWrites } from './indexeddb-write.test-utils';

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

  afterEach(() => vi.restoreAllMocks());

  describe('groups', () => {
    it('returns only the ungrouped group by default', () => {
      expect(service.groups()).toEqual([{ id: 'ungrouped', name: 'Ungrouped', order: 0 }]);
    });

    it('returns groups sorted by order', async () => {
      await saveData({
        groups: {
          a: { id: 'a', name: 'A', order: 2 },
          b: { id: 'b', name: 'B', order: 3 },
          c: { id: 'c', name: 'C', order: 1 },
        },
      });

      expect(service.groups().map((g) => g.name)).toEqual(['Ungrouped', 'C', 'A', 'B']);
    });
  });

  describe('createGroup', () => {
    it('creates a group with the next order and persists it', async () => {
      await saveData({
        groups: {
          [DEFAULT_GROUP_ID]: { id: 'ungrouped', name: 'Ungrouped', order: 0 },
          existing: { id: 'existing', name: 'Existing', order: 0 },
        },
      });

      const { value: created, durability } = await service.createGroup('New Group');

      expect(durability).toBe('persistent');
      expect(created.name).toBe('New Group');
      expect(created.order).toBe(1);
      expect(created.id).toMatch(/^group-/);
      expect(storageService.getData().groups[created.id]).toEqual(created);
    });

    it('uses the next order when groups exist', async () => {
      await saveData({
        groups: {
          [DEFAULT_GROUP_ID]: { id: 'ungrouped', name: 'Ungrouped', order: 0 },
          existing: { id: 'existing', name: 'Existing', order: 3 },
        },
      });

      const { value: created } = await service.createGroup('Solo');

      expect(created.order).toBe(4);
    });
  });

  describe('updateGroup', () => {
    it('updates an existing group', async () => {
      const group: Group = { id: 'g1', name: 'Original', order: 1 };
      await saveData({ groups: { [group.id]: group } });

      await service.updateGroup({ ...group, name: 'Renamed' });

      expect(storageService.getData().groups['g1'].name).toBe('Renamed');
    });
  });

  describe('deleteGroup', () => {
    it('rejects trying to delete the ungrouped group', async () => {
      await expect(service.deleteGroup(DEFAULT_GROUP_ID)).rejects.toThrow(
        'Cannot delete the ungrouped group',
      );
    });

    it('removes the group and moves its items to ungrouped', async () => {
      await saveData({
        groups: {
          [DEFAULT_GROUP_ID]: { id: 'ungrouped', name: 'Ungrouped', order: 0 },
          films: { id: 'films', name: 'Films', order: 1 },
          series: { id: 'series', name: 'Series', order: 2 },
        },
        items: {
          inFilms: createItem({ id: 'inFilms', groupId: 'films' }),
          untouched: createItem({ id: 'untouched', groupId: 'ungrouped' }),
          inSeries: createItem({ id: 'inSeries', groupId: 'series' }),
        },
      });

      await service.deleteGroup('films');

      const data = storageService.getData();
      expect(data.groups['films']).toBeUndefined();
      expect(data.groups['series']).toBeDefined();
      expect(data.groups['series'].name).toBe('Series');
      expect(data.items['inFilms'].groupId).toBe(DEFAULT_GROUP_ID);
      expect(data.items['untouched'].groupId).toBe(DEFAULT_GROUP_ID);
      expect(data.items['inSeries'].groupId).toBe('series');
    });
  });

  describe('reorderGroups', () => {
    it.each([
      [false, true],
      [true, true],
      [false, false],
      [true, false],
    ])(
      'preserves an imported __proto__ group through reorder and reload (member item: %s, listed: %s)',
      async (hasMember, listed) => {
        await storageService.importDataWithImages(
          {
            ...storageService.getData(),
            groups: {
              ...storageService.getData().groups,
              ['__proto__']: { id: '__proto__', name: 'Special', order: 1 },
            },
            items: hasMember ? { movie: createItem({ id: 'movie', groupId: '__proto__' }) } : {},
          },
          [],
        );
        await service.reorderGroups(listed ? ['__proto__', DEFAULT_GROUP_ID] : [DEFAULT_GROUP_ID]);

        const reloaded = TestBed.runInInjectionContext(() => new StorageService());
        await reloaded.initialize();
        expect(Object.hasOwn(reloaded.getData().groups, '__proto__')).toBe(true);
        expect(reloaded.getData().groups['__proto__']).toEqual({
          id: '__proto__',
          name: 'Special',
          order: listed ? 0 : 1,
        });
        expect(reloaded.getData().groups[DEFAULT_GROUP_ID].order).toBe(listed ? 1 : 0);
        expect(reloaded.getData().items).toEqual(
          hasMember ? { movie: createItem({ id: 'movie', groupId: '__proto__' }) } : {},
        );
      },
    );

    it('reassigns order from the provided id list', async () => {
      await saveData({
        groups: {
          a: { id: 'a', name: 'A', order: 0 },
          b: { id: 'b', name: 'B', order: 1 },
          c: { id: 'c', name: 'C', order: 2 },
        },
      });

      await service.reorderGroups(['c', 'a', 'b']);

      const groups = storageService.getData().groups;
      expect(groups['c'].order).toBe(0);
      expect(groups['a'].order).toBe(1);
      expect(groups['b'].order).toBe(2);
    });

    it('keeps groups not present in the reorder list', async () => {
      await saveData({
        groups: {
          a: { id: 'a', name: 'A', order: 0 },
          b: { id: 'b', name: 'B', order: 1 },
        },
      });

      await service.reorderGroups(['a']);

      const groups = storageService.getData().groups;
      expect(groups['a'].order).toBe(0);
      expect(groups['b'].order).toBe(1);
    });
  });

  describe('getGroupById', () => {
    it('returns the matching group', async () => {
      await saveData({ groups: { g1: { id: 'g1', name: 'G1', order: 0 } } });

      expect(service.getGroupById('g1')?.name).toBe('G1');
    });

    it('returns undefined for an unknown group', () => {
      expect(service.getGroupById('missing')).toBeUndefined();
    });
  });

  describe.each(['create', 'rename', 'delete', 'reorder'] as const)(
    'rapid %s then dependent intent',
    (firstKind) => {
      it.each([
        [false, false],
        [false, true],
        [true, false],
        [true, true],
      ])(
        'isolates aborted transactions and reloads settled results (%s, %s)',
        async (firstSucceeds, secondSucceeds) => {
          await saveData({
            groups: { films: { id: 'films', name: 'Films', order: 1 } },
            items: { movie: createItem({ id: 'movie', groupId: 'films' }) },
          });
          const films = storageService.getData().groups['films'];
          controlStorageWrites([firstSucceeds, secondSucceeds]);
          vi.spyOn(console, 'error').mockImplementation(() => undefined);

          const first = (() => {
            switch (firstKind) {
              case 'create':
                return service.createGroup('First');
              case 'rename':
                return service.updateGroup({ ...films, name: 'First rename' });
              case 'delete':
                return service.deleteGroup('films');
              case 'reorder':
                return service.reorderGroups(['films', DEFAULT_GROUP_ID]);
            }
          })();
          // These commands are invoked before the first transaction settles.
          const second =
            firstKind === 'create'
              ? service.createGroup('Second')
              : firstKind === 'delete'
                ? service.reorderGroups(['films', DEFAULT_GROUP_ID])
                : service.updateGroup({ ...films, name: 'Second rename' });
          const results = await Promise.allSettled([first, second]);
          expect(results.map((result) => result.status)).toEqual([
            firstSucceeds ? 'fulfilled' : 'rejected',
            secondSucceeds ? 'fulfilled' : 'rejected',
          ]);
          const data = storageService.getData();
          if (firstKind === 'create') {
            expect(service.groups().map((group) => [group.name, group.order])).toEqual([
              ['Ungrouped', 0],
              ['Films', 1],
              ...(firstSucceeds ? [['First', 2]] : []),
              ...(secondSucceeds ? [['Second', firstSucceeds ? 3 : 2]] : []),
            ]);
          } else if (firstKind === 'delete') {
            expect(Object.hasOwn(data.groups, 'films')).toBe(!firstSucceeds);
            expect(data.items['movie'].groupId).toBe(firstSucceeds ? DEFAULT_GROUP_ID : 'films');
          } else {
            expect(data.groups['films'].name).toBe(
              secondSucceeds
                ? 'Second rename'
                : firstKind === 'rename' && firstSucceeds
                  ? 'First rename'
                  : 'Films',
            );
            expect(data.groups['films'].order).toBe(
              firstKind === 'reorder' && firstSucceeds ? 0 : 1,
            );
            expect(data.items['movie'].groupId).toBe('films');
          }
          const reloaded = TestBed.runInInjectionContext(() => new StorageService());
          await reloaded.initialize();
          expect(reloaded.getData()).toEqual(data);
        },
      );
    },
  );

  it('does not resurrect a deleted group when a queued rename uses an old form snapshot', async () => {
    await saveData({ groups: { films: { id: 'films', name: 'Films', order: 1 } } });
    const oldGroup = storageService.getData().groups['films'];
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const results = await Promise.allSettled([
      service.deleteGroup('films'),
      service.updateGroup({ ...oldGroup, name: 'Resurrected' }),
      service.createGroup('Next'),
    ]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(service.groups().map((group) => group.name)).toEqual(['Ungrouped', 'Next']);
    const reloaded = TestBed.runInInjectionContext(() => new StorageService());
    await reloaded.initialize();
    expect(reloaded.getData()).toEqual(storageService.getData());
  });

  function saveData(data?: Partial<ReturnType<StorageService['getData']>>) {
    return storageService.saveData({
      schemaVersion: CURRENT_SCHEMA_VERSION,
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
      isAdult: false,
      watchHistory: [],
      createdAt: '2026-04-01T10:00:00.000Z',
    };
  }
});
