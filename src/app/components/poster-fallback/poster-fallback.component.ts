import { Component, computed, input } from '@angular/core';
import { isEpisodicType } from '../../domain/item.constants';
import { ItemType } from '../../models/item.model';

/** A typographic cover for titles without artwork; too-small slots keep only the motif. */
@Component({
  selector: 'app-poster-fallback',
  host: {
    class:
      '@container block w-full aspect-[2/3] bg-light-hover dark:bg-dark-bg-tertiary text-light-font dark:text-dark-font',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
  template: `
    <div
      class="flex h-full flex-col items-center justify-center gap-2 p-3 @[8rem]:items-start @[8rem]:justify-between"
    >
      <span class="text-light-font-secondary dark:text-dark-font-secondary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
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
      </span>
      @if (title(); as text) {
        <span
          class="hidden @[8rem]:line-clamp-8 text-sm @[11rem]:text-base leading-snug font-semibold break-words"
          >{{ text }}</span
        >
      }
    </div>
  `,
})
export class PosterFallbackComponent {
  readonly title = input<string>();
  readonly type = input<ItemType>();
  /** Set only when this stands in for an image; leave empty when the title is announced nearby. */
  readonly label = input<string>();

  protected readonly isEpisodic = computed(() => {
    const type = this.type();
    return !!type && isEpisodicType(type);
  });
}
