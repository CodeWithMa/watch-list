import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi, afterEach } from 'vitest';
import { Group } from '../../models/group.model';
import { GroupService } from '../../services/group.service';
import { GroupManagerComponent } from './group-manager.component';
import { StorageService } from '../../services/storage.service';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';

describe('GroupManagerComponent inline delete confirm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setup(initialGroups: Group[] = defaultGroups()) {
    const groups = signal<Group[]>(initialGroups);
    const deleteGroup = vi.fn().mockResolvedValue({ value: undefined, durability: 'persistent' });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: GroupService,
          useValue: {
            groups,
            createGroup: vi.fn(),
            updateGroup: vi.fn(),
            deleteGroup,
            reorderGroups: vi.fn(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(GroupManagerComponent);
    fixture.detectChanges();
    return { fixture, deleteGroup, groups };
  }

  function defaultGroups(): Group[] {
    return [
      { id: 'ungrouped', name: 'Ungrouped', order: 0 },
      { id: 'g1', name: 'Films', order: 1 },
    ];
  }

  function button(root: HTMLElement, text: string) {
    const found = [...root.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    if (!found) throw new Error(`Missing button: ${text}`);
    return found;
  }

  it('keeps keyboard focus on confirmation and returns it to Delete after cancellation', () => {
    const { fixture, deleteGroup } = setup();
    const root = fixture.nativeElement as HTMLElement;
    const remove = button(root, 'Delete');
    remove.focus();
    remove.click();
    fixture.detectChanges();

    expect(document.activeElement).toBe(button(root, 'Confirm Delete?'));
    expect(deleteGroup).not.toHaveBeenCalled();

    const cancel = button(root, 'Cancel');
    cancel.focus();
    cancel.click();
    fixture.detectChanges();

    expect(document.activeElement).toBe(button(root, 'Delete'));
    expect(deleteGroup).not.toHaveBeenCalled();
  });

  it('focuses the create-group input after the confirmed group is removed', async () => {
    const { fixture, deleteGroup, groups } = setup();
    deleteGroup.mockImplementation((id: string) => {
      groups.update((current) => current.filter((group) => group.id !== id));
      return Promise.resolve({ value: undefined, durability: 'persistent' });
    });
    const root = fixture.nativeElement as HTMLElement;
    button(root, 'Delete').click();
    fixture.detectChanges();
    const confirm = button(root, 'Confirm Delete?');
    confirm.focus();
    confirm.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(confirm.isConnected).toBe(false);
    expect(root.textContent).not.toContain('Films');
    expect(document.activeElement).toBe(root.querySelector('input[name="newGroupName"]'));
  });

  it('stages a delete without calling the service until confirmed', async () => {
    const { fixture, deleteGroup } = setup();

    fixture.componentInstance.requestDeleteGroup('g1');

    expect(deleteGroup).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pendingDeleteGroupId()).toBe('g1');

    await fixture.componentInstance.confirmDeleteGroup('g1');

    expect(deleteGroup).toHaveBeenCalledWith('g1');
    expect(fixture.componentInstance.pendingDeleteGroupId()).toBeNull();
  });

  it('cancels a staged delete without calling the service', () => {
    const { fixture, deleteGroup } = setup();

    fixture.componentInstance.requestDeleteGroup('g1');
    fixture.componentInstance.cancelDeleteGroup();

    expect(fixture.componentInstance.pendingDeleteGroupId()).toBeNull();
    expect(deleteGroup).not.toHaveBeenCalled();
  });

  it.each([
    { error: new Error('Unable to update groups'), message: 'Unable to update groups' },
    { error: { code: 'UNKNOWN' }, message: 'Failed to delete group' },
  ])(
    'keeps confirmation and shows an accurate inline error: $message',
    async ({ error, message }) => {
      const { fixture, deleteGroup } = setup();
      deleteGroup.mockImplementationOnce(() => {
        throw error;
      });
      const root = fixture.nativeElement as HTMLElement;
      button(root, 'Delete').click();
      fixture.detectChanges();
      const confirm = button(root, 'Confirm Delete?');
      confirm.focus();
      confirm.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(root.querySelector('[role="alert"]')?.textContent).toContain(message);
      expect(document.activeElement).toBe(button(root, 'Confirm Delete?'));
    },
  );

  it('renders the two-step confirm in the DOM without window.confirm', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { fixture, deleteGroup } = setup();

    const deleteButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) => button.textContent?.trim() === 'Delete',
    ) as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    expect(deleteGroup).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    const confirmButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) => button.textContent?.trim() === 'Confirm Delete?',
    );
    expect(confirmButton).not.toBeUndefined();
  });
});

describe('GroupManagerComponent settled interactions', () => {
  afterEach(() => vi.restoreAllMocks());

  it('awaits a native create submission and identifies session-only success', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('Unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({});
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    const fixture = TestBed.createComponent(GroupManagerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('input[name="newGroupName"]')!;
    input.value = 'Session group';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    const form = root.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(storage.getGroups().map((group) => group.name)).toEqual(['Ungrouped', 'Session group']);
    expect(input.value).toBe('');
    expect(root.querySelector('[role="status"]')?.textContent).toMatch(/session.*lost on reload/i);
    expect(storage.getInMemorySessionSignal()()).toBe(true);
    const reloaded = TestBed.runInInjectionContext(() => new StorageService());
    await reloaded.initialize();
    expect(reloaded.getGroups().map((group) => group.name)).toEqual(['Ungrouped']);
  });

  it.each(['create', 'rename', 'delete', 'reorder'] as const)(
    'keeps a failed %s interaction retryable and prevents duplicate submissions',
    async (operation) => {
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: new IDBFactory(),
      });
      TestBed.configureTestingModule({});
      const storage = TestBed.inject(StorageService);
      await storage.initialize();
      await storage.replaceData({
        ...storage.getData(),
        groups: {
          ...storage.getData().groups,
          films: { id: 'films', name: 'Films', order: 1 },
        },
      });
      const original = storage.getData();
      const fixture = TestBed.createComponent(GroupManagerComponent);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const component = fixture.componentInstance;
      const put = IDBObjectStore.prototype.put;
      let started!: (transaction: IDBTransaction) => void;
      const writing = new Promise<IDBTransaction>((resolve) => {
        started = resolve;
      });
      const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
        this: IDBObjectStore,
        value,
        key,
      ) {
        const request = put.call(this, value, key);
        if (this.name === 'storage') started(this.transaction);
        return request;
      });
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      component.newGroupName = operation === 'create' ? 'New Group' : 'Unrelated draft';
      component.requestDeleteGroup('films');
      if (operation === 'rename') {
        component.editGroup(original.groups['films']);
        component.editGroupName = 'Renamed';
      }
      const submit = () => {
        switch (operation) {
          case 'create':
            return component.createGroup();
          case 'rename':
            return component.saveEdit();
          case 'delete':
            return component.confirmDeleteGroup('films');
          case 'reorder':
            return component.moveUp('films');
        }
      };
      const failed = submit();
      const duplicate = submit();
      const transaction = await writing;
      fixture.detectChanges();
      expect([...root.querySelectorAll('button')].every((button) => button.disabled)).toBe(true);
      expect(storage.getData()).toEqual(original);
      transaction.abort();
      await Promise.all([failed, duplicate]);
      fixture.detectChanges();
      expect(root.querySelector('[role="alert"]')?.textContent).toMatch(/try again/i);
      expect(storage.getData()).toEqual(original);
      if (operation === 'create') expect(component.newGroupName).toBe('New Group');
      if (operation === 'rename') {
        expect(component.editingGroup()?.id).toBe('films');
        expect(component.editGroupName).toBe('Renamed');
      }
      if (operation === 'delete') expect(component.pendingDeleteGroupId()).toBe('films');

      spy.mockRestore();
      await submit();
      fixture.detectChanges();
      expect(root.querySelector('[role="alert"]')).toBeNull();
      expect(root.querySelector('[role="status"]')).toBeNull();
      expect(component.newGroupName).toBe(operation === 'create' ? '' : 'Unrelated draft');
      expect(component.pendingDeleteGroupId()).toBe(operation === 'delete' ? null : 'films');
      const groups = Object.values(storage.getData().groups);
      if (operation === 'create')
        expect(groups.map((group) => group.name)).toEqual(['Ungrouped', 'Films', 'New Group']);
      if (operation === 'rename') {
        expect(storage.getData().groups['films'].name).toBe('Renamed');
        expect(component.editingGroup()).toBeNull();
        expect(component.editGroupName).toBe('');
      }
      if (operation === 'delete') expect(storage.getData().groups['films']).toBeUndefined();
      if (operation === 'reorder')
        expect(storage.getGroups().map((group) => group.id)).toEqual(['films', 'ungrouped']);
      const reloaded = TestBed.runInInjectionContext(() => new StorageService());
      await reloaded.initialize();
      expect(reloaded.getData()).toEqual(storage.getData());
    },
  );
});
