import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Item } from '../../models/item.model';
import { TimeAgoComponent } from '../time-ago/time-ago.component';
import { calculateProgress, getMostRecentWatchDate } from '../../utils/progress.utils';
import { statusLineColor } from '../../utils/status.utils';
import { getPosterUrl, getPlaceholderUrl } from '../../utils/tmdb-image.utils';

@Component({
  selector: 'app-item-card',
  imports: [CommonModule, RouterLink, TimeAgoComponent],
  template: `
    <div
      class="border border-light-border dark:border-dark-border rounded-lg bg-light-bg-secondary dark:bg-dark-bg-secondary shadow-light dark:shadow-dark overflow-hidden"
    >
      <div [class]="'h-1 ' + statusColorClass()"></div>
      <div class="relative">
        @if (posterUrl()) {
          <img
            [src]="posterUrl()"
            [alt]="item().title + ' poster'"
            class="w-full aspect-[2/3] object-cover"
          />
        } @else {
          <img
            [src]="placeholderUrl()"
            [alt]="item().title + ' placeholder poster'"
            class="w-full aspect-[2/3] object-cover"
          />
        }
        @if (item().type === 'series' && item().progress) {
          <span
            class="absolute top-0 right-0 px-2 py-1 text-xs font-medium bg-black/60 text-white backdrop-blur-sm"
          >
            S{{ item().progress!.season }}E{{ item().progress!.episode }}
          </span>
        }
      </div>

      <div class="w-full h-1 bg-light-border dark:bg-dark-border">
        <div
          class="h-full bg-accent-success transition-[width] duration-300 ease-in-out"
          [style.width.%]="progressPercent() ?? 0"
        ></div>
      </div>

      <div class="p-3">
        <h3 class="m-0 text-sm font-medium truncate">
          <a
            [routerLink]="['/items', item().id]"
            class="no-underline text-light-font dark:text-dark-font hover:text-accent-primary"
            >{{ item().title }}</a
          >
        </h3>

        <div class="mt-1.5 text-xs text-light-font-secondary dark:text-dark-font-secondary">
          <app-time-ago [date]="lastWatchedDate()" />
        </div>
      </div>
    </div>
  `,
})
export class ItemCardComponent {
  item = input.required<Item>();

  posterUrl = computed(() => getPosterUrl(this.item().posterPath));
  placeholderUrl = computed(() => getPlaceholderUrl());
  statusColorClass = computed(() => statusLineColor(this.item().status));

  progressPercent = computed(() => {
    return calculateProgress(this.item());
  });

  lastWatchedDate = computed(() => {
    return getMostRecentWatchDate(this.item());
  });
}
