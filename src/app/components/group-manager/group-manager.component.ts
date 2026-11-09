import { Component, ElementRef, signal, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupService } from '../../services/group.service';
import { Group } from '../../models/group.model';
import { DEFAULT_GROUP_ID } from '../../domain/item.constants';
import { MutationFeedback } from '../mutation-feedback';
import { ConflictRecoveryComponent } from '../conflict-recovery/conflict-recovery.component';

@Component({
  selector: 'app-group-manager',
  imports: [FormsModule, ConflictRecoveryComponent],
  template: `
    <div class="reading-measure">
      <h1 class="page-title mb-6">Groups</h1>
      @if (!editingGroup()) {
        <app-conflict-recovery [disabled]="busy()" (recovered)="operationError.set(null)" />
      }

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
      <div class="card p-4 sm:p-6 mb-6">
        <h2 class="section-title mb-4">New group</h2>
        <form (ngSubmit)="createGroup()" class="flex flex-col sm:flex-row gap-3">
          <input
            #newGroupInput
            type="text"
            [(ngModel)]="newGroupName"
            name="newGroupName"
            placeholder="Group name"
            required
            [readOnly]="busy()"
            aria-label="Group name"
            class="form-control flex-1"
          />
          <button type="submit" [disabled]="busy()" class="btn btn-primary">Create group</button>
        </form>
      </div>

      <div class="card p-4 sm:p-6">
        <h2 class="section-title mb-4">Your groups</h2>
        @for (group of groups(); track group.id; let i = $index) {
          <div
            class="flex flex-wrap justify-between items-center gap-2 py-3 border-b border-light-border-light dark:border-dark-border-light last:border-b-0"
          >
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="font-medium">{{ group.name }}</span>
              @if (group.id === defaultGroupId) {
                <span class="meta">Titles without a group</span>
              }
            </div>
            <div class="flex gap-2">
              @if (groups().length > 1) {
                <button
                  (click)="moveUp(group.id)"
                  [disabled]="busy() || i === 0"
                  class="btn btn-secondary !px-3"
                  [title]="i === 0 ? 'Already first' : 'Move ' + group.name + ' up'"
                  [attr.aria-label]="'Move ' + group.name + ' up'"
                >
                  ↑
                </button>
                <button
                  (click)="moveDown(group.id)"
                  [disabled]="busy() || i === groups().length - 1"
                  class="btn btn-secondary !px-3"
                  [title]="
                    i === groups().length - 1 ? 'Already last' : 'Move ' + group.name + ' down'
                  "
                  [attr.aria-label]="'Move ' + group.name + ' down'"
                >
                  ↓
                </button>
              }
              @if (group.id !== defaultGroupId) {
                <button (click)="editGroup(group)" [disabled]="busy()" class="btn btn-secondary">
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
                  class="btn"
                  [class.btn-danger]="pendingDeleteGroupId() === group.id"
                  [class.btn-quiet-danger]="pendingDeleteGroupId() !== group.id"
                >
                  {{ pendingDeleteGroupId() === group.id ? 'Confirm delete' : 'Delete' }}
                </button>
                @if (pendingDeleteGroupId() === group.id) {
                  <button
                    (click)="cancelDeleteGroup(); deleteButton.focus()"
                    [disabled]="busy()"
                    class="btn btn-secondary"
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
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1000]">
          <div class="card p-4 sm:p-6 w-full max-w-md">
            <h3 class="section-title mb-6">Edit group</h3>
            <app-conflict-recovery [disabled]="busy()" (recovered)="operationError.set(null)" />
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
                aria-label="Group name"
                class="form-control"
              />
              <div class="flex gap-4 mt-6">
                <button type="submit" [disabled]="busy()" class="btn btn-primary">Save</button>
                <button
                  type="button"
                  [disabled]="busy()"
                  (click)="cancelEdit()"
                  class="btn btn-secondary"
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
  private readonly mutation = new MutationFeedback((error, action) => {
    const detail = error instanceof Error ? error.message : `Failed to ${action}`;
    return `${detail} Please try again.`;
  });
  readonly busy = this.mutation.busy;
  readonly operationError = this.mutation.error;
  readonly sessionSuccess = this.mutation.sessionSuccess;

  async createGroup() {
    if (!this.newGroupName.trim()) return;
    const result = await this.mutation.run(
      () => this.groupService.createGroup(this.newGroupName.trim()),
      'create group',
    );
    if (result) this.newGroupName = '';
  }

  editGroup(group: Group): void {
    if (this.busy()) return;
    this.operationError.set(null);
    this.editingGroup.set(group);
    this.editGroupName = group.name;
  }

  async saveEdit() {
    const group = this.editingGroup();
    if (!group || !this.editGroupName.trim()) return;
    const result = await this.mutation.run(
      () =>
        this.groupService.updateGroup({
          id: group.id,
          name: this.editGroupName.trim(),
        }),
      'rename group',
    );
    if (result) {
      this.editingGroup.set(null);
      this.editGroupName = '';
    }
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
    if (this.pendingDeleteGroupId() !== groupId) return;
    const result = await this.mutation.run(
      () => this.groupService.deleteGroup(groupId),
      'delete group',
    );
    if (result) {
      this.pendingDeleteGroupId.set(null);
      this.newGroupInput().nativeElement.focus();
    }
  }

  moveUp(groupId: string) {
    return this.move(groupId, -1);
  }

  moveDown(groupId: string) {
    return this.move(groupId, 1);
  }

  private async move(groupId: string, direction: number) {
    const sorted = this.groups();
    const index = sorted.findIndex((g) => g.id === groupId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    const groupIds = sorted.map((g) => g.id);
    [groupIds[index], groupIds[target]] = [groupIds[target], groupIds[index]];
    await this.mutation.run(() => this.groupService.reorderGroups(groupIds), 'reorder groups');
  }
}
