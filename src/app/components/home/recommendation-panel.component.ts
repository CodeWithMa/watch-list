import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DEFAULT_GROUP_ID, ITEM_TYPE_LABELS, isEpisodicType } from '../../domain/item.constants';
import { getCurrentSeason } from '../../domain/episode-release';
import { ReadonlyItem as Item } from '../../models/item.model';
import { GroupService } from '../../services/group.service';
import {
  calculateProgress,
  formatEpisode,
  getMostRecentWatchDate,
} from '../../utils/progress.utils';
import { PosterComponent } from '../poster/poster.component';
import { TimeAgoComponent } from '../time-ago/time-ago.component';

/** The answer to "what next?": title, next episode, and one dominant action. */
@Component({
  selector: 'app-recommendation-panel',
  imports: [RouterLink, PosterComponent, TimeAgoComponent],
  host: { class: '@container block' },
  template: `
    <article class="card p-3 sm:p-4">
      <!-- Actions follow the text, so a short movie card has no gap above its button. -->
      <div
        class="grid grid-cols-[4rem_minmax(0,1fr)] @md:grid-cols-[8rem_minmax(0,1fr)] @md:grid-rows-[auto_1fr] gap-x-3 @md:gap-x-5 gap-y-3"
      >
        <app-poster [item]="item()" class="self-start rounded-md @md:row-span-2" />
        <div class="min-w-0">
          <h3 class="m-0 text-lg/snug @md:text-xl/tight font-bold tracking-tight">
            <a
              [routerLink]="['/items', item().id]"
              [title]="item().title"
              class="line-clamp-3 no-underline text-light-font dark:text-dark-font hover:text-accent-text"
              >{{ item().title }}</a
            >
          </h3>
          <p class="meta mt-1 mb-0">
            {{ typeLabel() }}
            @if (groupName(); as group) {
              <span aria-hidden="true"> · </span>{{ group }}
            }
            @if (item().watchHistory.length) {
              <span aria-hidden="true"> · </span>Watched
              <app-time-ago [date]="lastWatchedDate()" />
            }
          </p>
          @if (episode(); as next) {
            <p class="mt-2 mb-0 text-sm @md:text-base">
              Next episode: <strong class="font-semibold">{{ next }}</strong>
              @if (totalEpisodes(); as total) {
                <span class="text-light-font-secondary dark:text-dark-font-secondary">
                  of {{ total }}</span
                >
              }
            </p>
            @if (progressPercent(); as percent) {
              <div
                class="mt-2 h-1.5 rounded-full bg-light-border dark:bg-dark-border overflow-hidden"
              >
                <div class="h-full rounded-full bg-accent-primary" [style.width.%]="percent"></div>
              </div>
            }
          }
        </div>
        <div class="col-span-2 @md:col-span-1 @md:col-start-2 self-start flex flex-col gap-1">
          <button
            type="button"
            (click)="watched.emit()"
            [disabled]="busy()"
            class="btn btn-primary w-full"
          >
            {{ episode() ? 'Mark ' + episode() + ' watched' : 'Mark watched' }}
          </button>
          <div class="flex flex-wrap items-center gap-1 -mx-1">
            @if (episode()) {
              <button
                type="button"
                (click)="deferred.emit()"
                [disabled]="busy()"
                [attr.aria-expanded]="deferOpen()"
                aria-controls="deferral-panel"
                title="Hide this episode from recommendations until it's available."
                class="btn btn-quiet px-2 shrink-0 aria-expanded:bg-light-hover dark:aria-expanded:bg-dark-hover"
              >
                Defer episode
              </button>
            }
            <button
              type="button"
              (click)="paused.emit()"
              [disabled]="busy()"
              class="btn btn-quiet px-2 shrink-0"
            >
              Pause
            </button>
            <button
              type="button"
              (click)="dropped.emit()"
              [disabled]="busy()"
              title="Stop watching this title. Its history is kept, and you can restart it later."
              class="btn btn-quiet-danger ml-auto px-2 shrink-0"
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
  private readonly groups = inject(GroupService).groups;
  readonly item = input.required<Item>();
  readonly busy = input(false);
  /** Whether the deferral chooser this panel's "Defer episode" opens is showing. */
  readonly deferOpen = input(false);
  readonly watched = output();
  readonly deferred = output();
  readonly paused = output();
  readonly dropped = output();

  protected readonly typeLabel = computed(() => ITEM_TYPE_LABELS[this.item().type]);
  // "Ungrouped" is the absence of a choice, not context worth repeating on every card.
  protected readonly groupName = computed(() => {
    const { groupId } = this.item();
    if (groupId === DEFAULT_GROUP_ID) return null;
    return this.groups().find(({ id }) => id === groupId)?.name || null;
  });
  protected readonly lastWatchedDate = computed(() => getMostRecentWatchDate(this.item()));
  protected readonly episode = computed(() => {
    const { progress, type } = this.item();
    return progress && isEpisodicType(type) ? formatEpisode(progress) : null;
  });
  protected readonly totalEpisodes = computed(() => getCurrentSeason(this.item())?.totalEpisodes);
  protected readonly progressPercent = computed(() => calculateProgress(this.item()));
}
