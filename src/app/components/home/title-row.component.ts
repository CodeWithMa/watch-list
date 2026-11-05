import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ITEM_TYPE_LABELS } from '../../domain/item.constants';
import { ReadonlyItem as Item } from '../../models/item.model';

@Component({
  selector: 'app-title-row',
  imports: [RouterLink],
  host: {
    class: '@container block border-b border-light-border dark:border-dark-border last:border-b-0',
  },
  template: `
    <div
      class="grid grid-cols-[minmax(0,1fr)_auto] @md:grid-cols-[minmax(0,auto)_1fr_auto] items-center gap-x-3 gap-y-1 px-3 sm:px-4 py-2"
    >
      <a
        [routerLink]="['/items', item().id]"
        [title]="item().title"
        class="col-span-2 @md:col-span-1 line-clamp-2 no-underline text-sm sm:text-base font-medium text-light-font dark:text-dark-font hover:text-accent-text"
        >{{ item().title }}</a
      >
      <span class="text-xs text-light-font-secondary dark:text-dark-font-secondary">{{
        typeLabel()
      }}</span>
      <div class="flex gap-1">
        <button
          type="button"
          (click)="started.emit()"
          [disabled]="busy()"
          [attr.aria-label]="actionLabel() + ' ' + item().title"
          class="btn btn-secondary"
        >
          {{ actionLabel() }}
        </button>
        <button
          type="button"
          (click)="dropped.emit()"
          [disabled]="busy()"
          [attr.aria-label]="'Drop ' + item().title"
          title="Stop watching this title. Its history is kept, and you can restart it later."
          class="btn btn-quiet"
        >
          Drop
        </button>
      </div>
    </div>
  `,
})
export class TitleRowComponent {
  readonly item = input.required<Item>();
  readonly actionLabel = input.required<string>();
  readonly busy = input(false);
  readonly started = output();
  readonly dropped = output();

  protected readonly typeLabel = computed(() => ITEM_TYPE_LABELS[this.item().type]);
}
