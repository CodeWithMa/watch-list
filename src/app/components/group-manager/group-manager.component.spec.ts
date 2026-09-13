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
    return { fixture, deleteGroup };
  }

  function defaultGroups(): Group[] {
    return [
      { id: 'ungrouped', name: 'Ungrouped', order: 0 },
      { id: 'g1', name: 'Films', order: 1 },
    ];
  }

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

  it('shows an inline error when deleting fails', () => {
    const { fixture, deleteGroup } = setup();
    deleteGroup.mockImplementationOnce(() => {
      throw new Error('Cannot delete the ungrouped group');
    });

    fixture.componentInstance.requestDeleteGroup('g1');
    fixture.componentInstance.confirmDeleteGroup('g1');
    fixture.detectChanges();

    expect(fixture.componentInstance.deleteError()).toBe('Cannot delete the ungrouped group');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
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
