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
    <div class="flex flex-col gap-2">
      <div class="relative overflow-hidden rounded-lg">
        <app-poster [item]="item()" />
        @if (progressPercent() !== null && isActive()) {
          <div class="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <div
              class="h-full bg-accent-primary transition-[width] duration-300 ease-in-out"
              [style.width.%]="progressPercent()"
            ></div>
          </div>
        }
      </div>

      <div class="flex flex-col gap-1">
        <h3 class="m-0 text-sm sm:text-[0.9375rem] leading-snug font-semibold">
          <a
            [routerLink]="['/items', item().id]"
            [title]="item().title"
            class="line-clamp-3 no-underline text-light-font dark:text-dark-font hover:text-accent-text"
            >{{ item().title }}</a
          >
        </h3>

        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span [class]="statusBadge()">{{ statusLabel() }}</span>
          <span class="meta">{{ typeLabel() }}</span>
        </div>

        @if (nextEpisode(); as next) {
          <div class="text-meta font-medium">Next: {{ next }}</div>
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
