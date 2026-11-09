import { Component, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReadonlyItem as Item } from '../../models/item.model';
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS, isEpisodicType } from '../../domain/item.constants';
import { TimeAgoComponent } from '../time-ago/time-ago.component';
import { PosterComponent } from '../poster/poster.component';
import {
  calculateProgress,
  formatEpisode,
  getMostRecentWatchDate,
} from '../../utils/progress.utils';
import { statusBadgeClass } from '../../utils/status.utils';

@Component({
  selector: 'app-item-card',
  imports: [RouterLink, TimeAgoComponent, PosterComponent],
  template: `
    <div class="group flex flex-col gap-2.5">
      <div
        class="relative overflow-hidden rounded-lg ring-accent-text/70 transition-[box-shadow,translate] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:ring-2 group-focus-within:ring-2 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
      >
        <app-poster [item]="item()" />
      </div>

      <div class="flex flex-col gap-1.5">
        <!-- A fixed two-line slot keeps every badge row in a grid row on one baseline. -->
        <h3 class="m-0 sm:min-h-[2lh] text-sm sm:text-[0.9375rem] leading-snug font-semibold">
          <a
            [routerLink]="['/items', item().id]"
            [title]="item().title"
            class="line-clamp-3 sm:line-clamp-2 no-underline text-light-font dark:text-dark-font hover:text-accent-text group-hover:underline underline-offset-2"
            >{{ item().title }}</a
          >
        </h3>

        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span [class]="statusBadge()">{{ statusLabel() }}</span>
          <span class="meta">{{ typeLabel() }}</span>
        </div>

        @if (nextEpisode(); as next) {
          <!-- Progress sits beside the episode it describes, never over the artwork. -->
          <div class="flex items-center gap-2 text-meta font-medium">
            <span class="shrink-0">Next: {{ next }}</span>
            @if (progressPercent()) {
              <span
                class="flex-1 max-w-20 h-1 rounded-full bg-light-border dark:bg-dark-border overflow-hidden"
                [title]="progressPercent() + '% of this season watched'"
                aria-hidden="true"
              >
                <span
                  class="block h-full rounded-full bg-accent-primary dark:bg-accent-text transition-[width] duration-300 ease-in-out"
                  [style.width.%]="progressPercent()"
                ></span>
              </span>
            }
          </div>
        }
        @if (item().watchHistory.length) {
          <div class="meta">Watched <app-time-ago [date]="lastWatchedDate()" /></div>
        }
      </div>
    </div>
  `,
})
export class ItemCardComponent {
  item = input.required<Item>();

  statusBadge = computed(() => statusBadgeClass(this.item().status));
  statusLabel = computed(() => ITEM_STATUS_LABELS[this.item().status]);
  typeLabel = computed(() => ITEM_TYPE_LABELS[this.item().type]);
  isActive = computed(() => ['in-progress', 'paused'].includes(this.item().status));
  nextEpisode = computed(() => {
    const { progress, type } = this.item();
    return progress && isEpisodicType(type) && this.isActive() ? formatEpisode(progress) : null;
  });

  progressPercent = computed(() => {
    return calculateProgress(this.item());
  });

  lastWatchedDate = computed(() => {
    return getMostRecentWatchDate(this.item());
  });
}
