import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReadonlyItem as Item } from '../../models/item.model';
import { injectPosterUrl } from '../../services/poster-reader';
import { ProviderSettingsService } from '../../services/provider-settings.service';
import { PosterFallbackComponent } from '../poster-fallback/poster-fallback.component';

@Component({
  selector: 'app-poster',
  imports: [RouterLink, PosterFallbackComponent],
  host: { class: 'relative block overflow-hidden' },
  template: `
    <a
      [routerLink]="['/items', item().id]"
      tabindex="-1"
      aria-hidden="true"
      class="block no-underline"
    >
      @if (posterUrl()) {
        <img
          [src]="posterUrl()"
          alt=""
          class="block w-full aspect-[2/3] object-cover"
          [style.filter]="shouldBlur() ? 'blur(12px)' : null"
        />
      } @else if (posterUrl() === null) {
        <app-poster-fallback [title]="item().title" [type]="item().type" />
      } @else {
        <div class="w-full aspect-[2/3] bg-light-hover dark:bg-dark-bg-tertiary"></div>
      }
    </a>
    @if (shouldBlur()) {
      <button
        type="button"
        (click)="revealed.set(true)"
        class="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm font-medium backdrop-blur-[2px] cursor-pointer border-0"
        aria-label="Reveal adult poster"
      >
        Adult — click to reveal
      </button>
    }
  `,
})
export class PosterComponent {
  private providerSettings = inject(ProviderSettingsService);
  readonly item = input.required<Item>();

  readonly posterUrl = injectPosterUrl(() => this.item().posterId);
  readonly revealed = signal(false);
  readonly shouldBlur = computed(() => {
    const mode = this.providerSettings.settings().adultDisplayMode;
    // 'blur' blurs everywhere; 'hide' still blurs where card remains visible (next*), since next* is not filtered
    // 'show' never blurs
    return this.item().isAdult && mode !== 'show' && !!this.posterUrl() && !this.revealed();
  });

  constructor() {
    effect(() => {
      // Reset click-to-reveal when item identity changes
      void this.item().id;
      this.revealed.set(false);
    });
  }
}
