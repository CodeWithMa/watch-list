import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ITEM_TYPE_LABELS, isEpisodicType } from '../../domain/item.constants';
import { getCurrentSeason } from '../../domain/episode-release';
import { ReadonlyItem as Item } from '../../models/item.model';
import { calculateProgress, formatEpisode } from '../../utils/progress.utils';
import { PosterComponent } from '../poster/poster.component';

/** The answer to "what next?": title, next episode, and one dominant action. */
@Component({
  selector: 'app-recommendation-panel',
  imports: [RouterLink, PosterComponent],
  host: { class: '@container block' },
  template: `
    <article class="card p-3 sm:p-4">
      <div
        class="grid grid-cols-[5rem_minmax(0,1fr)] @md:grid-cols-[7rem_minmax(0,1fr)] gap-3 @md:gap-x-4"
      >
        <app-poster [item]="item()" class="self-start rounded @md:row-span-2" />
        <div class="min-w-0">
          <h3 class="m-0 text-lg sm:text-xl leading-snug font-semibold">
            <a
              [routerLink]="['/items', item().id]"
              class="line-clamp-3 no-underline text-light-font dark:text-dark-font hover:text-accent-text"
              >{{ item().title }}</a
            >
          </h3>
          <p class="mt-1 mb-0 text-xs text-light-font-secondary dark:text-dark-font-secondary">
            {{ typeLabel() }}
          </p>
          @if (episode(); as next) {
            <p class="mt-2 mb-0 text-sm">
              Next episode: <strong class="font-semibold">{{ next }}</strong>
              @if (totalEpisodes(); as total) {
                <span class="text-light-font-secondary dark:text-dark-font-secondary">
                  of {{ total }}</span
                >
              }
            </p>
            @if (progressPercent(); as percent) {
              <div
                class="mt-2 h-1 rounded-full bg-light-border dark:bg-dark-border overflow-hidden"
              >
                <div class="h-full bg-accent-primary" [style.width.%]="percent"></div>
              </div>
            }
          }
        </div>
        <div class="col-span-2 @md:col-span-1 @md:col-start-2 @md:self-end flex flex-col gap-1">
          <button
            type="button"
            (click)="watched.emit()"
            [disabled]="busy()"
            class="btn btn-primary w-full"
          >
            {{ episode() ? 'Mark ' + episode() + ' watched' : 'Mark Watched' }}
          </button>
          <div class="flex gap-1 @md:-ml-2">
            @if (episode()) {
              <button
                type="button"
                (click)="deferred.emit()"
                [disabled]="busy()"
                class="btn btn-quiet flex-1 @md:flex-none px-2 whitespace-nowrap"
              >
                Not available?
              </button>
            }
            <button
              type="button"
              (click)="paused.emit()"
              [disabled]="busy()"
              class="btn btn-quiet flex-1 @md:flex-none px-2"
            >
              Pause
            </button>
            <button
              type="button"
              (click)="dropped.emit()"
              [disabled]="busy()"
              title="Stop watching this title. Its history is kept, and you can restart it later."
              class="btn btn-quiet flex-1 @md:flex-none px-2"
            >
              Drop
            </button>
          </div>
        </div>
      </div>
      <ng-content />
    </article>
  `,
})
export class RecommendationPanelComponent {
  readonly item = input.required<Item>();
  readonly busy = input(false);
  readonly watched = output();
  readonly deferred = output();
  readonly paused = output();
  readonly dropped = output();

  protected readonly typeLabel = computed(() => ITEM_TYPE_LABELS[this.item().type]);
  protected readonly episode = computed(() => {
    const { progress, type } = this.item();
    return progress && isEpisodicType(type) ? formatEpisode(progress) : null;
  });
  protected readonly totalEpisodes = computed(() => getCurrentSeason(this.item())?.totalEpisodes);
  protected readonly progressPercent = computed(() => calculateProgress(this.item()));
}
