import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { ItemFormComponent } from '../item-form/item-form.component';
import { buildItemMutationInput, createDefaultItemFormValue, ItemFormValue } from '../../domain/item-form';

@Component({
  selector: 'app-add-item',
  imports: [ItemFormComponent],
  template: `
    <div class="max-w-[600px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Add New Item</h1>

      <app-item-form
        [groups]="groups()"
        [initialValue]="initialValue"
        submitLabel="Add Item"
        [showStartImmediately]="true"
        [showStatusPicker]="false"
        (submitted)="onSubmit($event)"
        (cancelled)="cancel()"
      />
    </div>
    `
})
export class AddItemComponent {
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);
  private router = inject(Router);

  readonly groups = this.groupService.groups;
  readonly initialValue = createDefaultItemFormValue();

  onSubmit(formValue: ItemFormValue): void {
    this.watchListService.addItem(buildItemMutationInput(formValue));

    this.router.navigate(['/items']);
  }

  cancel(): void {
    this.router.navigate(['/items']);
  }
}
