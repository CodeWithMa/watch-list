import { Component, computed, input } from '@angular/core';
import { isEpisodicType } from '../../domain/item.constants';
import { ItemType } from '../../models/item.model';

/** A quiet stand-in for missing artwork; the title stays with the surrounding text. */
@Component({
  selector: 'app-poster-fallback',
  host: {
    class: 'block w-full aspect-[2/3] bg-light-bg-tertiary dark:bg-dark-bg-tertiary',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
  template: `
    <div class="flex h-full items-center justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-1/3 max-w-12 text-light-font-muted dark:text-dark-font-muted"
        aria-hidden="true"
      >
        @if (isEpisodic()) {
          <rect x="2" y="7" width="20" height="15" rx="2" />
          <path d="M17 2l-5 5-5-5" />
        } @else {
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 3v18M17 3v18M3 12h18M3 7.5h4M3 16.5h4M17 7.5h4M17 16.5h4" />
        }
      </svg>
    </div>
  `,
})
export class PosterFallbackComponent {
  readonly type = input<ItemType>();
  /** Set only when this stands in for an image; leave empty when the title is announced nearby. */
  readonly label = input<string>();

  protected readonly isEpisodic = computed(() => {
    const type = this.type();
    return !!type && isEpisodicType(type);
  });
}
