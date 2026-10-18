import { Component, computed, inject, signal, ViewChild } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { ItemFormComponent } from '../item-form/item-form.component';
import {
  buildItemEditInput,
  createDefaultItemFormValue,
  createItemFormValue,
  ItemFormValue,
} from '../../domain/item-form';
import { ItemMutationFeedback } from '../item-mutation-feedback';

@Component({
  selector: 'app-item-detail',
  imports: [ItemFormComponent, RouterLink],
  template: `
    <div>
      @if (item()) {
        <div class="border border-light-border dark:border-dark-border rounded-lg p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="mt-0">Edit Item</h2>
            <div class="flex gap-2">
              @if (!confirmDelete()) {
                <button
                  type="button"
                  [disabled]="mutation.busy()"
                  (click)="confirmDelete.set(true)"
                  class="px-6 py-3 border border-accent-danger rounded bg-transparent text-accent-danger cursor-pointer hover:bg-accent-danger hover:text-white"
                >
                  Delete
                </button>
              } @else {
                <button
                  type="button"
                  [disabled]="mutation.busy()"
                  (click)="deleteItem()"
                  class="px-6 py-3 border border-accent-danger rounded bg-accent-danger text-white cursor-pointer hover:bg-accent-danger-hover animate-pulse"
                >
                  Confirm Delete?
                </button>
                <button
                  type="button"
                  [disabled]="mutation.busy()"
                  (click)="cancelDelete()"
                  class="px-6 py-3 bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font border border-light-border dark:border-dark-border rounded cursor-pointer"
                >
                  Cancel
                </button>
              }
            </div>
          </div>
          @if (!itemExists()) {
            <p role="alert" class="text-accent-danger">
              This item was deleted while you were editing. Your draft cannot be saved.
              <a [routerLink]="['/items']">Back to Items</a>
            </p>
          }
          <app-item-form
            [groups]="groups()"
            [initialValue]="formValue()"
            submitLabel="Save Changes"
            [busy]="mutation.busy()"
            [error]="mutation.error()"
            [showDirtyState]="true"
            [resetOnCancel]="true"
            [disableSubmitWhenPristine]="true"
            (submitted)="saveChanges($event)"
          />
        </div>
      } @else {
        <div class="text-center px-8 py-16">
          <h2 class="mb-4">Item not found</h2>
          <a [routerLink]="['/items']">Back to Items</a>
        </div>
      }
    </div>
  `,
})
export class ItemDetailComponent {
  @ViewChild(ItemFormComponent) private form?: ItemFormComponent;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);

  readonly groups = this.groupService.groups;
  readonly mutation = new ItemMutationFeedback();

  // Capture a baseline per routed item; live collection updates must not reset an open draft.
  readonly item = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = params.get('id');
        return id ? (this.watchListService.getItemById(id) ?? null) : null;
      }),
    ),
    { initialValue: null },
  );
  readonly itemExists = computed(() =>
    this.watchListService.items().some((item) => item.id === this.item()?.id),
  );
  readonly formValue = computed(() => {
    const currentItem = this.item();
    return currentItem ? createItemFormValue(currentItem) : createDefaultItemFormValue();
  });
  confirmDelete = signal(false);

  async saveChanges(formValue: ItemFormValue): Promise<void> {
    const currentItem = this.item();
    if (!currentItem) return;

    const result = await this.mutation.run(
      () =>
        this.watchListService.updateItem(
          currentItem.id,
          buildItemEditInput(this.formValue(), formValue),
        ),
      'Unable to save this item.',
    );
    if (result) {
      this.form?.commitDrafts();
      this.router.navigate(['/items']);
    }
  }

  cancelDelete(): void {
    if (this.mutation.busy()) return;
    this.confirmDelete.set(false);
  }

  async deleteItem(): Promise<void> {
    const currentItem = this.item();
    if (currentItem) {
      const result = await this.mutation.run(
        () => this.watchListService.deleteItem(currentItem.id),
        'Unable to delete this item.',
      );
      if (result) this.router.navigate(['/items']);
    }
  }
}
