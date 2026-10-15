import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi, afterEach } from 'vitest';
import { Group } from '../../models/group.model';
import { GroupService } from '../../services/group.service';
import { GroupManagerComponent } from './group-manager.component';

describe('GroupManagerComponent inline delete confirm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setup(initialGroups: Group[] = defaultGroups()) {
    const groups = signal<Group[]>(initialGroups);
    const deleteGroup = vi.fn();
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

  it('focuses the create-group input after the confirmed group is removed', () => {
    const { fixture, deleteGroup, groups } = setup();
    deleteGroup.mockImplementation((id: string) => {
      groups.update((current) => current.filter((group) => group.id !== id));
    });
    const root = fixture.nativeElement as HTMLElement;
    button(root, 'Delete').click();
    fixture.detectChanges();
    const confirm = button(root, 'Confirm Delete?');
    confirm.focus();
    confirm.click();
    fixture.detectChanges();

    expect(confirm.isConnected).toBe(false);
    expect(root.textContent).not.toContain('Films');
    expect(document.activeElement).toBe(root.querySelector('input[name="newGroupName"]'));
  });

  it('stages a delete without calling the service until confirmed', () => {
    const { fixture, deleteGroup } = setup();

    fixture.componentInstance.requestDeleteGroup('g1');

    expect(deleteGroup).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pendingDeleteGroupId()).toBe('g1');

    fixture.componentInstance.confirmDeleteGroup('g1');

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
  ])('shows an accurate inline error and restores Delete focus: $message', ({ error, message }) => {
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
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(document.activeElement).toBe(button(root, 'Delete'));
  });

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
