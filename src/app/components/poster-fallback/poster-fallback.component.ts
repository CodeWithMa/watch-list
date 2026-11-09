import { Component, computed, input } from '@angular/core';
import { isEpisodicType } from '../../domain/item.constants';
import { ItemType } from '../../models/item.model';

const MINOR_WORDS = new Set(['a', 'an', 'the', 'of', 'and', 'in', 'on', 'to', 'for', 'at']);

/** Up to two initials from the title's significant words, e.g. "House of the Dragon" → "HD". */
export function titleMonogram(title: string): string {
  const words = title.split(/[\s:–—-]+/).filter((word) => /\p{L}|\p{N}/u.test(word));
  const significant =
    words.length > 1 ? words.filter((w) => !MINOR_WORDS.has(w.toLowerCase())) : words;
  return significant
    .slice(0, 2)
    .map((word) => [...word.replace(/^[^\p{L}\p{N}]+/u, '')][0] ?? '')
    .join('')
    .toLocaleUpperCase();
}

/**
 * A deliberate stand-in for missing artwork: the title's initials over a tinted surface, so a
 * library without posters reads as designed rather than broken. The title stays with nearby text.
 */
@Component({
  selector: 'app-poster-fallback',
  host: {
    class:
      '@container relative block w-full aspect-[2/3] bg-light-bg-tertiary dark:bg-dark-bg-tertiary shadow-[inset_0_0_0_1px_rgb(0_0_0/0.05)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
  template: `
    <!-- Thumbnails have room for one legible initial; larger tiles show both. -->
    @if (monogram().length) {
      @let letters = monogram();
      <span
        class="absolute inset-0 flex items-center justify-center font-semibold tracking-tight select-none text-light-font-muted/55 dark:text-dark-font-muted/55 @max-[4rem]:text-[45cqw]"
        [class]="letters.length > 1 ? 'text-[24cqw]' : 'text-[30cqw]'"
        >{{ letters[0]
        }}<span class="@max-[4rem]:hidden">{{ letters.slice(1).join('') }}</span></span
      >
    }
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="absolute text-light-font-muted dark:text-dark-font-muted"
      [class]="
        monogram().length
          ? 'hidden @[6rem]:block left-[8cqw] bottom-[8cqw] size-[12cqw] max-w-6'
          : 'inset-0 m-auto size-1/3 max-w-12'
      "
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
  `,
})
export class PosterFallbackComponent {
  readonly type = input<ItemType>();
  /** Shows the title's initials; without it, only the type glyph is drawn. */
  readonly title = input<string>();
  /** Set only when this stands in for an image; leave empty when the title is announced nearby. */
  readonly label = input<string>();

  // Code points, so an initial outside the BMP is never split in half.
  protected readonly monogram = computed(() => [...titleMonogram(this.title() ?? '')]);
  protected readonly isEpisodic = computed(() => {
    const type = this.type();
    return !!type && isEpisodicType(type);
  });
}
