import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { Item } from '../../models/item.model';
import { ItemFormComponent } from '../item-form/item-form.component';
import {
  buildItemMutationInput,
  createDefaultItemFormValue,
  createItemFormValue,
  ItemFormValue,
} from '../../domain/item-form';

@Component({
  selector: 'app-item-detail',
  imports: [ItemFormComponent, RouterLink],
  template: `
    <div class="max-w-[800px] mx-auto p-8">
      @if (item()) {
        <div class="border border-light-border dark:border-dark-border rounded-lg p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="mt-0">Edit Item</h2>
            <div class="flex gap-2">
              @if (!confirmDelete()) {
                <button
                  type="button"
                  (click)="confirmDelete.set(true)"
                  class="px-6 py-3 border border-accent-danger rounded bg-transparent text-accent-danger cursor-pointer hover:bg-accent-danger hover:text-white"
                >
                  Delete
                </button>
              } @else {
                <button
                  type="button"
                  (click)="deleteItem()"
                  class="px-6 py-3 border border-accent-danger rounded bg-accent-danger text-white cursor-pointer hover:bg-accent-danger-hover animate-pulse"
                >
                  Confirm Delete?
                </button>
                <button
                  type="button"
                  (click)="cancelDelete()"
                  class="px-6 py-3 bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font border border-light-border dark:border-dark-border rounded cursor-pointer"
                >
                  Cancel
                </button>
              }
            </div>
          </div>
          <app-item-form
            [groups]="groups()"
            [initialValue]="formValue()"
            submitLabel="Save Changes"
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);

  readonly groups = this.groupService.groups;

  readonly item = computed<Item | null>(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return id ? (this.watchListService.items().find((item) => item.id === id) ?? null) : null;
  });
  readonly formValue = computed(() => {
    const currentItem = this.item();
    return currentItem ? createItemFormValue(currentItem) : createDefaultItemFormValue();
  });
  confirmDelete = signal(false);

  async saveChanges(formValue: ItemFormValue): Promise<void> {
    const currentItem = this.item();
    if (!currentItem) return;

    const updated: Item = {
      ...currentItem,
      ...buildItemMutationInput(formValue),
    };

    await this.watchListService.updateItem(updated);
    this.router.navigate(['/items']);
  }

  cancelDelete(): void {
    this.confirmDelete.set(false);
  }

  async deleteItem(): Promise<void> {
    const currentItem = this.item();
    if (currentItem) {
      await this.watchListService.deleteItem(currentItem.id);
      this.router.navigate(['/items']);
    }
  }
}
