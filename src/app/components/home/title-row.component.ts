import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ITEM_TYPE_LABELS } from '../../domain/item.constants';
import { ReadonlyItem as Item } from '../../models/item.model';

@Component({
  selector: 'app-title-row',
  imports: [RouterLink],
  host: {
    class:
      'flex items-center gap-3 px-3 sm:px-4 py-2 border-b border-light-border dark:border-dark-border last:border-b-0',
  },
  template: `
    <div class="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
      <a
        [routerLink]="['/items', item().id]"
        class="block sm:truncate no-underline text-sm sm:text-base font-medium text-light-font dark:text-dark-font hover:text-accent-text"
        >{{ item().title }}</a
      >
      <span class="shrink-0 text-xs text-light-font-secondary dark:text-dark-font-secondary">{{
        typeLabel()
      }}</span>
    </div>
    <div class="flex shrink-0 gap-1">
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
