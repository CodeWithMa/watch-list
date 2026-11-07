import { Component, computed, inject, signal } from '@angular/core';
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
import { itemMutationFailure } from '../item-mutation-feedback';
import { MutationFeedback } from '../mutation-feedback';
import { ConflictRecoveryComponent } from '../conflict-recovery/conflict-recovery.component';

@Component({
  selector: 'app-item-detail',
  imports: [ItemFormComponent, RouterLink, ConflictRecoveryComponent],
  template: `
    <div>
      <app-conflict-recovery [disabled]="mutation.busy()" (recovered)="mutation.error.set(null)" />
      @if (item(); as currentItem) {
        <div class="reading-measure">
          <a [routerLink]="['/items', currentItem.id]" class="back-link">{{ currentItem.title }}</a>
          <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
            <h1 class="page-title">Edit details</h1>
            <div class="flex flex-wrap gap-2">
              @if (!confirmDelete()) {
                <button
                  type="button"
                  [disabled]="mutation.busy()"
                  (click)="confirmDelete.set(true)"
                  class="btn btn-quiet-danger"
                >
                  Delete title
                </button>
              } @else {
                <button
                  type="button"
                  [disabled]="mutation.busy()"
                  (click)="deleteItem()"
                  class="btn btn-danger"
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  [disabled]="mutation.busy()"
                  (click)="cancelDelete()"
                  class="btn btn-secondary"
                >
                  Cancel
                </button>
              }
            </div>
          </div>
          @if (!itemExists()) {
            <p role="alert" class="text-accent-danger-text">
              This title was deleted while you were editing. Your draft cannot be saved.
              <a routerLink="/items" class="underline">Open library</a>
            </p>
          }
          <app-item-form
            [groups]="groups()"
            [initialValue]="formValue()"
            submitLabel="Save changes"
            [busy]="mutation.busy()"
            [error]="mutation.error()"
            [showDirtyState]="true"
            [resetOnCancel]="true"
            [revealSeasonDetails]="revealSeasonDetails"
            [disableSubmitWhenPristine]="true"
            (submitted)="saveChanges($event)"
          />
        </div>
      } @else {
        <div class="card reading-measure text-center px-8 py-16">
          <h2 class="section-title mb-2">Title not found</h2>
          <p class="mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">
            It may have been deleted.
          </p>
          <a routerLink="/items" class="btn btn-secondary">Open library</a>
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
  readonly mutation = new MutationFeedback(itemMutationFailure);
  readonly revealSeasonDetails = this.route.snapshot?.fragment === 'season-details';

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
      'Unable to save this title.',
    );
    if (result) {
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
        'Unable to delete this title.',
      );
      if (result) this.router.navigate(['/items']);
    }
  }
}
