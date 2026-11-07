import { Component, input, output } from '@angular/core';
import { ReadonlyItem as Item } from '../../models/item.model';
import { TitleRowComponent } from './title-row.component';

/** Offers an explicit start for an empty slot; backlog titles are never recommended on their own. */
@Component({
  selector: 'app-backlog-choices',
  imports: [TitleRowComponent],
  template: `
    @if (items().length > 0) {
      <h3 class="m-0 px-3 sm:px-4 py-3 text-sm font-semibold">
        Start a {{ noun() }} from your backlog
      </h3>
      <div class="border-t border-light-border dark:border-dark-border">
        @for (choice of items(); track choice.id) {
          <app-title-row
            [item]="choice"
            actionLabel="Start"
            [busy]="busy()"
            (started)="started.emit(choice.id)"
            (dropped)="dropped.emit(choice.id)"
          />
        }
      </div>
      @if (moreCount() > 0) {
        <button
          type="button"
          (click)="seeMore.emit()"
          class="w-full min-h-11 px-3 sm:px-4 text-left text-sm text-accent-text underline cursor-pointer border-t border-light-border dark:border-dark-border"
        >
          See {{ moreCount() }} more below
        </button>
      }
    }
  `,
})
export class BacklogChoicesComponent {
  readonly items = input.required<readonly Item[]>();
  readonly noun = input.required<string>();
  readonly moreCount = input(0);
  readonly busy = input(false);
  readonly started = output<string>();
  readonly dropped = output<string>();
  readonly seeMore = output();
}
