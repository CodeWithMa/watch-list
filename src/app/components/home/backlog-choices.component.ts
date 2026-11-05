import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReadonlyItem as Item } from '../../models/item.model';

const CHOICE_LIMIT = 3;

/** Offers an explicit start for an empty slot; backlog titles are never recommended on their own. */
@Component({
  selector: 'app-backlog-choices',
  imports: [RouterLink],
  template: `
    @if (items().length > 0) {
      <h3 class="mt-3 mb-1 text-sm font-semibold">Choose a {{ noun() }} from your backlog</h3>
      <ul class="m-0 p-0 list-none">
        @for (choice of items().slice(0, limit); track choice.id) {
          <li class="flex items-center gap-2 py-1">
            <a
              [routerLink]="['/items', choice.id]"
              class="flex-1 min-w-0 truncate text-sm no-underline text-light-font dark:text-dark-font hover:text-accent-text"
              >{{ choice.title }}</a
            >
            <button
              type="button"
              (click)="started.emit(choice.id)"
              [disabled]="busy()"
              [attr.aria-label]="'Start ' + choice.title"
              class="btn btn-secondary shrink-0"
            >
              Start
            </button>
          </li>
        }
      </ul>
      @if (items().length > limit) {
        <button
          type="button"
          (click)="seeAll.emit()"
          class="mt-1 min-h-11 text-sm text-accent-text underline cursor-pointer"
        >
          See all {{ items().length }} in backlog
        </button>
      }
    }
  `,
})
export class BacklogChoicesComponent {
  readonly items = input.required<readonly Item[]>();
  readonly noun = input.required<string>();
  readonly busy = input(false);
  readonly started = output<string>();
  readonly seeAll = output();
  protected readonly limit = CHOICE_LIMIT;
}
