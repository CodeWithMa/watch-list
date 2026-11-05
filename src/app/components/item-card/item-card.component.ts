import { Component, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReadonlyItem as Item } from '../../models/item.model';
import { ITEM_STATUS_LABELS, isEpisodicType } from '../../domain/item.constants';
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
    <div class="card overflow-hidden h-full flex flex-col">
      <app-poster [item]="item()" />

      @if (progressPercent() !== null && isActive()) {
        <div class="w-full h-1 bg-light-border dark:bg-dark-border">
          <div
            class="h-full bg-accent-primary transition-[width] duration-300 ease-in-out"
            [style.width.%]="progressPercent()"
          ></div>
        </div>
      }

      <div class="p-3 flex flex-col flex-1 gap-2">
        <h3 class="m-0 text-sm sm:text-[0.9375rem] leading-snug font-medium">
          <a
            [routerLink]="['/items', item().id]"
            [title]="item().title"
            class="line-clamp-2 min-h-[2lh] no-underline text-light-font dark:text-dark-font hover:text-accent-text"
            >{{ item().title }}</a
          >
        </h3>

        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span [class]="statusBadge()">{{ statusLabel() }}</span>
          @if (nextEpisode(); as next) {
            <span class="font-medium text-light-font dark:text-dark-font">Next: {{ next }}</span>
          }
        </div>

        <div class="mt-auto text-xs text-light-font-secondary dark:text-dark-font-secondary">
          {{ item().watchHistory.length ? 'Watched' : 'Added' }}
          <app-time-ago [date]="lastWatchedDate()" />
        </div>
      </div>
    </div>
  `,
})
export class ItemCardComponent {
  item = input.required<Item>();

  statusBadge = computed(() => statusBadgeClass(this.item().status));
  statusLabel = computed(() => ITEM_STATUS_LABELS[this.item().status]);
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
