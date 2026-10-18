import { TestBed } from '@angular/core/testing';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { GroupService } from './group.service';
import { StorageService } from './storage.service';
import { WatchListService } from './watch-list.service';
import type { Item } from '../models/item.model';

describe('Group and item mutation coexistence', () => {
  afterEach(() => vi.restoreAllMocks());

  describe.each(['add', 'update', 'delete'] as const)('%s item', (itemAction) => {
    describe.each([true, false])('overlap: %s', (overlap) => {
      it.each(['create', 'rename', 'delete', 'reorder'] as const)(
        'preserves a committed group %s across the item save',
        async (groupAction) => {
          const { storage, groups, items, target } = await setup();

          // Start the real item command after the group put succeeds but before its
          // transaction completes. No application methods or queue internals are mocked.
          let itemWrite: Promise<void> | undefined;
          const saveItem = () => runItemCommand(items, itemAction, target);
          const put = IDBObjectStore.prototype.put;
          if (overlap)
            vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (
              this: IDBObjectStore,
              value,
              key,
            ) {
              const request = put.call(this, value, key);
              request.addEventListener('success', () => {
                itemWrite = saveItem();
              });
              return request;
            });

          let createdId: string | undefined;
          switch (groupAction) {
            case 'create':
              createdId = (await groups.createGroup('New Group')).value.id;
              break;
            case 'rename':
              await groups.updateGroup({ id: 'films', name: 'Renamed' });
              break;
            case 'delete':
              await groups.deleteGroup('films');
              break;
            case 'reorder':
              await groups.reorderGroups(['films', 'ungrouped']);
              break;
          }
          if (!overlap) itemWrite = saveItem();
          expect(itemWrite).toBeDefined();
          await itemWrite;
          const reloaded = TestBed.runInInjectionContext(() => new StorageService());
          await reloaded.initialize();
          const summarize = (service: StorageService) => {
            const data = service.getData();
            return {
              filmsExists: Object.hasOwn(data.groups, 'films'),
              filmsName: data.groups['films']?.name,
              filmsOrder: data.groups['films']?.order,
              movieGroup: data.items['movie'].groupId,
              createdGroupExists: createdId ? Object.hasOwn(data.groups, createdId) : undefined,
              targetTitle: data.items['target']?.title,
              deletedTitle: data.deletedItems?.['target']?.itemTitle,
              itemCount: Object.keys(data.items).length,
            };
          };
          const expected = {
            filmsExists: groupAction !== 'delete',
            filmsName:
              groupAction === 'delete' ? undefined : groupAction === 'rename' ? 'Renamed' : 'Films',
            filmsOrder: groupAction === 'delete' ? undefined : groupAction === 'reorder' ? 0 : 1,
            movieGroup: groupAction === 'delete' ? 'ungrouped' : 'films',
            createdGroupExists: groupAction === 'create' ? true : undefined,
            targetTitle:
              itemAction === 'delete' ? undefined : itemAction === 'update' ? 'After' : 'Before',
            deletedTitle: itemAction === 'delete' ? 'Before' : undefined,
            itemCount: itemAction === 'add' ? 3 : itemAction === 'delete' ? 1 : 2,
          };
          expect({ live: summarize(storage), reloaded: summarize(reloaded) }).toEqual({
            live: expected,
            reloaded: expected,
          });
        },
      );
    });
  });

  describe.each(['add', 'update', 'delete'] as const)(
    '%s an item in a deleting group',
    (action) => {
      it.each([
        [false, false],
        [false, true],
        [true, false],
        [true, true],
      ])(
        'preserves settled group/item outcomes and reloads (%s, %s)',
        async (groupSucceeds, itemSucceeds) => {
          const { storage, groups, items, movie } = await setup();
          const outcomes = [groupSucceeds, itemSucceeds];
          const put = IDBObjectStore.prototype.put;
          vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
            this: IDBObjectStore,
            value,
            key,
          ) {
            const request = put.call(this, value, key);
            if (this.name === 'storage' && outcomes.shift() === false) {
              request.addEventListener('success', () => this.transaction.abort());
            }
            return request;
          });
          vi.spyOn(console, 'error').mockImplementation(() => undefined);
          const deletion = groups.deleteGroup('films');
          const itemWrite = runItemCommand(items, action, movie);
          const outcomesReceived = await Promise.allSettled([deletion, itemWrite]);
          expect(outcomesReceived.map((outcome) => outcome.status)).toEqual([
            groupSucceeds ? 'fulfilled' : 'rejected',
            itemSucceeds ? 'fulfilled' : 'rejected',
          ]);
          const data = storage.getData();
          expect(Object.hasOwn(data.groups, 'films')).toBe(!groupSucceeds);
          expect(data.items['movie']?.title).toBe(
            action === 'delete' && itemSucceeds
              ? undefined
              : action === 'update' && itemSucceeds
                ? 'After'
                : 'In Films',
          );
          expect(data.items['movie']?.groupId).toBe(
            action === 'delete' && itemSucceeds ? undefined : groupSucceeds ? 'ungrouped' : 'films',
          );
          expect(Object.values(data.items).find((item) => item.title === 'Added')?.groupId).toBe(
            action === 'add' && itemSucceeds ? (groupSucceeds ? 'ungrouped' : 'films') : undefined,
          );
          expect(data.deletedItems?.['movie']?.itemTitle).toBe(
            action === 'delete' && itemSucceeds ? 'In Films' : undefined,
          );
          const reloaded = TestBed.runInInjectionContext(() => new StorageService());
          await reloaded.initialize();
          expect(reloaded.getData()).toEqual(data);
        },
      );
    },
  );

  it('preserves group changes across rapid item writes in a session-only collection', async () => {
    const { storage, groups, items, movie } = await setup(true);
    const results = await Promise.all([
      groups.deleteGroup('films'),
      items.addItem({
        title: 'Added',
        type: 'movie',
        groupId: 'films',
        status: 'not-started',
        isAdult: false,
      }),
      items.updateItem({ ...movie, title: 'After' }),
    ]);
    expect(results[0].durability).toBe('session-only');
    expect(storage.getGroups().map((group) => group.id)).toEqual(['ungrouped']);
    expect(storage.getItems().map((item) => [item.title, item.groupId])).toEqual([
      ['After', 'ungrouped'],
      ['Before', 'ungrouped'],
      ['Added', 'ungrouped'],
    ]);
    expect(storage.getInMemorySessionSignal()()).toBe(true);
    expect(storage.getSaveErrorSignal()()).toBeNull();
  });
});

async function setup(session = false) {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  if (session) {
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('Unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  }
  TestBed.configureTestingModule({});
  const storage = TestBed.inject(StorageService);
  const groups = TestBed.inject(GroupService);
  const items = TestBed.inject(WatchListService);
  await storage.initialize();
  const movie: Item = {
    id: 'movie',
    title: 'In Films',
    type: 'movie',
    groupId: 'films',
    status: 'not-started',
    isAdult: false,
    watchHistory: [],
    createdAt: '2026-01-01',
  };
  const target: Item = { ...movie, id: 'target', title: 'Before', groupId: 'ungrouped' };
  await storage.saveData({
    ...storage.getData(),
    groups: { ...storage.getData().groups, films: { id: 'films', name: 'Films', order: 1 } },
    items: { movie, target },
  });
  return { storage, groups, items, movie, target };
}

function runItemCommand(
  service: WatchListService,
  action: 'add' | 'update' | 'delete',
  target: Item,
) {
  switch (action) {
    case 'add':
      return service.addItem({
        title: 'Added',
        type: 'movie',
        groupId: target.groupId,
        status: 'not-started',
        isAdult: false,
      });
    case 'update':
      return service.updateItem({ ...target, title: 'After' });
    case 'delete':
      return service.deleteItem(target.id);
  }
}
