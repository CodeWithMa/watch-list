import {
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { SuggestionSource } from '../../models/suggestion.model';

@Component({
  selector: 'app-search-provider-select',
  host: {
    class: 'relative shrink-0',
    '[class.hidden]': 'sources().length < 2',
    '(keydown)': 'onKeydown($event)',
    '(focusout)': 'onFocusOut($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
  template: `
    @if (sources().length > 1) {
      <button
        #trigger
        type="button"
        [attr.aria-label]="label() + ': ' + labels[value() ?? sources()[0]]"
        [title]="'Search with ' + labels[value() ?? sources()[0]]"
        aria-haspopup="menu"
        [attr.aria-expanded]="isOpen()"
        (click)="toggle()"
        class="flex size-(--search-control-size) items-center justify-center rounded-l border border-light-border dark:border-dark-border bg-light-bg-secondary dark:bg-dark-bg-secondary hover:bg-light-hover dark:hover:bg-dark-hover cursor-pointer focus-visible:outline-2 focus-visible:outline-accent-primary focus-visible:-outline-offset-2"
      >
        <img
          [src]="'icons/providers/' + (value() ?? sources()[0]) + '.svg'"
          alt=""
          class="size-6"
        />
      </button>
      @if (isOpen()) {
        <div
          role="menu"
          [attr.aria-label]="label()"
          class="absolute left-0 top-full z-30 mt-1 min-w-40 p-1 rounded border border-light-border dark:border-dark-border bg-light-bg-secondary dark:bg-dark-bg-secondary shadow-lg"
        >
          @for (source of sources(); track source; let index = $index) {
            <button
              #option
              type="button"
              role="menuitemradio"
              [attr.aria-checked]="source === value()"
              tabindex="-1"
              (focus)="activeIndex.set(index)"
              (click)="select(source)"
              class="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-light-font dark:text-dark-font hover:bg-light-hover dark:hover:bg-dark-hover focus:bg-light-hover dark:focus:bg-dark-hover focus-visible:outline-2 focus-visible:outline-accent-primary cursor-pointer"
            >
              <img [src]="'icons/providers/' + source + '.svg'" alt="" class="size-5" />
              <span>{{ labels[source] }}</span>
              @if (source === value()) {
                <span aria-hidden="true" class="ml-auto text-accent-primary">✓</span>
              }
            </button>
          }
        </div>
      }
    }
  `,
})
export class SearchProviderSelectComponent {
  readonly sources = input.required<SuggestionSource[]>();
  readonly value = input.required<SuggestionSource | undefined>();
  readonly label = input.required<string>();
  readonly valueChange = output<SuggestionSource>();
  readonly labels = { tmdb: 'TMDB', jikan: 'Jikan', anilist: 'AniList' };
  readonly isOpen = signal(false);
  readonly activeIndex = signal(0);

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly options = viewChildren<ElementRef<HTMLButtonElement>>('option');

  constructor() {
    afterRenderEffect(() => {
      if (this.isOpen()) this.options()[this.activeIndex()]?.nativeElement.focus();
    });
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open(
        Math.max(
          0,
          this.sources().findIndex((source) => source === this.value()),
        ),
      );
    }
  }

  select(source: SuggestionSource): void {
    this.close();
    if (source !== this.value()) this.valueChange.emit(source);
  }

  onDocumentClick(event: MouseEvent): void {
    if (event.target instanceof Node && !this.element.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  onFocusOut(event: FocusEvent): void {
    if (
      event.relatedTarget instanceof Node &&
      !this.element.nativeElement.contains(event.relatedTarget)
    ) {
      this.isOpen.set(false);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.open(event.key === 'ArrowDown' ? 0 : this.sources().length - 1);
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close();
        break;
      case 'Tab':
        this.close();
        break;
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update(
          (index) =>
            (index + (event.key === 'ArrowDown' ? 1 : -1) + this.sources().length) %
            this.sources().length,
        );
        break;
      case 'Home':
      case 'End':
        event.preventDefault();
        this.activeIndex.set(event.key === 'Home' ? 0 : this.sources().length - 1);
        break;
    }
  }

  private open(index: number): void {
    this.activeIndex.set(index);
    this.isOpen.set(true);
  }

  private close(): void {
    this.isOpen.set(false);
    this.trigger()?.nativeElement.focus();
  }
}
