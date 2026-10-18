import { Component, ElementRef, signal, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupService } from '../../services/group.service';
import { Group } from '../../models/group.model';
import { DEFAULT_GROUP_ID } from '../../domain/item.constants';
import type { MutationResult } from '../../services/storage.service';

@Component({
  selector: 'app-group-manager',
  imports: [FormsModule],
  template: `
    <div>
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Group Management</h1>

      @if (operationError() && !editingGroup()) {
        <div
          role="alert"
          class="mb-4 p-4 rounded bg-error-bg-light dark:bg-error-bg-dark text-error-text-light dark:text-error-text-dark"
        >
          {{ operationError() }}
        </div>
      }
      @if (sessionSuccess()) {
        <p role="status" class="mb-4">
          Changes are only kept for this session and will be lost on reload.
        </p>
      }
      <div class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg mb-8">
        <h2 class="text-xl mb-4 text-light-font-secondary dark:text-dark-font-secondary">
          Create New Group
        </h2>
        <form (ngSubmit)="createGroup()" class="flex gap-4">
          <input
            #newGroupInput
            type="text"
            [(ngModel)]="newGroupName"
            name="newGroupName"
            placeholder="Group name"
            required
            [readOnly]="busy()"
            class="flex-1 p-3 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font"
          />
          <button
            type="submit"
            [disabled]="busy()"
            class="px-6 py-3 bg-accent-primary text-white border-none rounded cursor-pointer font-medium hover:bg-accent-primary-hover"
          >
            Create Group
          </button>
        </form>
      </div>

      <div
        class="bg-light-bg-secondary dark:bg-dark-bg-secondary border border-light-border dark:border-dark-border rounded-lg p-6"
      >
        <h2 class="text-xl mb-4 text-light-font-secondary dark:text-dark-font-secondary">Groups</h2>
        @for (group of groups(); track group.id; let i = $index) {
          <div
            class="flex justify-between items-center p-4 border-b border-light-border-light dark:border-dark-border-light last:border-b-0"
          >
            <div class="flex flex-col gap-1">
              <span class="font-medium text-lg">{{ group.name }}</span>
            </div>
            <div class="flex gap-2">
              @if (i > 0) {
                <button
                  (click)="moveUp(group.id)"
                  [disabled]="busy()"
                  class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
                  title="Move up"
                >
                  ↑
                </button>
              }
              @if (i < groups().length - 1) {
                <button
                  (click)="moveDown(group.id)"
                  [disabled]="busy()"
                  class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
                  title="Move down"
                >
                  ↓
                </button>
              }
              @if (group.id !== defaultGroupId) {
                <button
                  (click)="editGroup(group)"
                  [disabled]="busy()"
                  class="px-4 py-2 border border-accent-warning rounded bg-accent-warning text-black dark:text-white hover:bg-accent-warning-hover cursor-pointer text-sm"
                >
                  Edit
                </button>
              }
              @if (group.id !== defaultGroupId) {
                <button
                  #deleteButton
                  [disabled]="busy()"
                  (click)="
                    pendingDeleteGroupId() === group.id
                      ? confirmDeleteGroup(group.id)
                      : requestDeleteGroup(group.id)
                  "
                  [class.animate-pulse]="pendingDeleteGroupId() === group.id"
                  class="px-4 py-2 border border-accent-danger rounded bg-accent-danger text-white hover:bg-accent-danger-hover cursor-pointer text-sm"
                >
                  {{ pendingDeleteGroupId() === group.id ? 'Confirm Delete?' : 'Delete' }}
                </button>
                @if (pendingDeleteGroupId() === group.id) {
                  <button
                    (click)="cancelDeleteGroup(); deleteButton.focus()"
                    [disabled]="busy()"
                    class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
                  >
                    Cancel
                  </button>
                }
              }
            </div>
          </div>
        }
      </div>

      @if (editingGroup()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div class="bg-light-bg-secondary dark:bg-dark-bg-secondary p-8 rounded-lg min-w-[400px]">
            <h3 class="mt-0 mb-6">Edit Group</h3>
            @if (operationError()) {
              <div role="alert" class="mb-4 text-error-text-light dark:text-error-text-dark">
                {{ operationError() }}
              </div>
            }
            <form (ngSubmit)="saveEdit()">
              <input
                type="text"
                [(ngModel)]="editGroupName"
                name="editGroupName"
                required
                [readOnly]="busy()"
                class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font"
              />
              <div class="flex gap-4 mt-6">
                <button
                  type="submit"
                  [disabled]="busy()"
                  class="px-6 py-3 bg-accent-primary text-white border-none rounded cursor-pointer hover:bg-accent-primary-hover"
                >
                  Save
                </button>
                <button
                  type="button"
                  [disabled]="busy()"
                  (click)="cancelEdit()"
                  class="px-6 py-3 bg-accent-secondary text-white border-none rounded cursor-pointer hover:bg-accent-secondary-hover"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
})
export class GroupManagerComponent {
  private groupService = inject(GroupService);
  private newGroupInput = viewChild.required<ElementRef<HTMLInputElement>>('newGroupInput');

  readonly groups = this.groupService.groups;
  readonly defaultGroupId = DEFAULT_GROUP_ID;

  editingGroup = signal<Group | null>(null);
  editGroupName = '';
  newGroupName = '';
  pendingDeleteGroupId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly operationError = signal<string | null>(null);
  readonly sessionSuccess = signal(false);

  async createGroup() {
    if (this.busy() || !this.newGroupName.trim()) return;
    await this.run(
      'create group',
      () => this.groupService.createGroup(this.newGroupName.trim()),
      () => {
        this.newGroupName = '';
      },
    );
  }

  editGroup(group: Group): void {
    if (this.busy()) return;
    this.operationError.set(null);
    this.editingGroup.set(group);
    this.editGroupName = group.name;
  }

  async saveEdit() {
    const group = this.editingGroup();
    if (this.busy() || !group || !this.editGroupName.trim()) return;
    await this.run(
      'rename group',
      () =>
        this.groupService.updateGroup({
          id: group.id,
          name: this.editGroupName.trim(),
        }),
      () => {
        this.editingGroup.set(null);
        this.editGroupName = '';
      },
    );
  }

  cancelEdit(): void {
    if (this.busy()) return;
    this.operationError.set(null);
    this.editingGroup.set(null);
    this.editGroupName = '';
  }

  requestDeleteGroup(groupId: string): void {
    if (this.busy()) return;
    this.operationError.set(null);
    this.pendingDeleteGroupId.set(groupId);
  }

  cancelDeleteGroup(): void {
    if (this.busy()) return;
    this.operationError.set(null);
    this.pendingDeleteGroupId.set(null);
  }

  async confirmDeleteGroup(groupId: string) {
    if (this.busy() || this.pendingDeleteGroupId() !== groupId) return;
    await this.run(
      'delete group',
      () => this.groupService.deleteGroup(groupId),
      () => {
        this.pendingDeleteGroupId.set(null);
        this.newGroupInput().nativeElement.focus();
      },
    );
  }

  moveUp(groupId: string) {
    return this.move(groupId, -1);
  }

  moveDown(groupId: string) {
    return this.move(groupId, 1);
  }

  private async move(groupId: string, direction: number) {
    if (this.busy()) return;
    const sorted = this.groups();
    const index = sorted.findIndex((g) => g.id === groupId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    const groupIds = sorted.map((g) => g.id);
    [groupIds[index], groupIds[target]] = [groupIds[target], groupIds[index]];
    await this.run('reorder groups', () => this.groupService.reorderGroups(groupIds));
  }

  private async run(
    action: string,
    operation: () => Promise<MutationResult<unknown>>,
    onSuccess?: () => void,
  ) {
    this.busy.set(true);
    this.operationError.set(null);
    this.sessionSuccess.set(false);
    try {
      const result = await operation();
      this.sessionSuccess.set(result.durability === 'session-only');
      onSuccess?.();
    } catch (error) {
      const detail = error instanceof Error ? error.message : `Failed to ${action}`;
      this.operationError.set(`${detail} Please try again.`);
    } finally {
      this.busy.set(false);
    }
  }
}
