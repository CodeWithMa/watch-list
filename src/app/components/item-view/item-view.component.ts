import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { ImageStorageService } from '../../services/image-storage.service';
import { Item, ItemStatus } from '../../models/item.model';
import { TimeAgoComponent } from '../time-ago/time-ago.component';
import { getMostRecentWatchDate } from '../../utils/progress.utils';
import { getPlaceholderUrl } from '../../utils/tmdb-image.utils';
import { isEpisodicType } from '../../domain/item.constants';
import {
  canSnoozeCurrentSeason,
  getCurrentEpisodeAirDate,
  getCurrentSeason,
  isValidSnoozeCount,
} from '../../domain/episode-release';

type QuickAction = 'watched' | 'started' | 'paused' | 'dropped';

@Component({
  selector: 'app-item-view',
  imports: [DatePipe, RouterLink, TimeAgoComponent],
  template: `
    <div>
      @if (item(); as currentItem) {
        <div class="flex items-center justify-between mb-6">
          <h1 class="m-0">{{ currentItem.title }}</h1>
          <div class="flex gap-2">
            <a
              [routerLink]="['/items', currentItem.id, 'edit']"
              class="px-6 py-3 bg-accent-primary text-white no-underline rounded font-medium hover:bg-accent-primary-hover"
              >Edit Item</a
            >
          </div>
        </div>

        <div
          class="border border-light-border dark:border-dark-border rounded-lg bg-light-bg-secondary dark:bg-dark-bg-secondary p-6 mb-6"
        >
          <div class="flex flex-col gap-6 sm:flex-row">
            <img
              [src]="posterUrl()"
              [alt]="currentItem.title + ' poster'"
              class="w-full max-w-[180px] aspect-[2/3] object-cover rounded"
            />

            <dl class="grid grid-cols-1 gap-4 flex-1 m-0 sm:grid-cols-2">
              <div>
                <dt class="text-sm text-light-font-muted dark:text-dark-font-muted">Type</dt>
                <dd class="m-0 capitalize">{{ currentItem.type }}</dd>
              </div>
              <div>
                <dt class="text-sm text-light-font-muted dark:text-dark-font-muted">Status</dt>
                <dd class="m-0 capitalize">{{ currentItem.status.replace('-', ' ') }}</dd>
              </div>
              <div>
                <dt class="text-sm text-light-font-muted dark:text-dark-font-muted">Group</dt>
                <dd class="m-0">{{ groupName() ?? 'Ungrouped' }}</dd>
              </div>
              <div>
                <dt class="text-sm text-light-font-muted dark:text-dark-font-muted">Added</dt>
                <dd class="m-0">{{ currentItem.createdAt | date: 'medium' }}</dd>
              </div>
              <div>
                <dt class="text-sm text-light-font-muted dark:text-dark-font-muted">
                  Last watched
                </dt>
                <dd class="m-0">
                  @if (hasWatchHistory()) {
                    <app-time-ago [date]="lastWatchedDate()" />
                  } @else {
                    Never
                  }
                </dd>
              </div>
              @if (currentItem.progress) {
                <div>
                  <dt class="text-sm text-light-font-muted dark:text-dark-font-muted">Progress</dt>
                  <dd class="m-0 font-mono">
                    S{{ currentItem.progress.season }}E{{ currentItem.progress.episode }}
                  </dd>
                </div>
              }
            </dl>
          </div>
        </div>

        <section class="mb-6">
          <h2 class="text-xl mb-3">Quick Actions</h2>
          <div class="flex flex-wrap gap-2">
            @for (action of quickActions(); track action.label) {
              <button
                type="button"
                (click)="runAction(action.action)"
                class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-primary dark:bg-dark-bg-primary text-light-font dark:text-dark-font cursor-pointer hover:border-accent-primary transition-colors"
              >
                {{ action.label }}
              </button>
            }
            @if (showReleaseDelayControls()) {
              <button
                type="button"
                (click)="changeReleaseDelay(1)"
                [disabled]="savingReleaseDelay() || !canSnooze()"
                aria-describedby="release-delay-feedback"
                class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-primary dark:bg-dark-bg-primary text-light-font dark:text-dark-font cursor-pointer hover:border-accent-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Snooze 1 week
              </button>
              @if (canRemoveDelay()) {
                <button
                  type="button"
                  (click)="changeReleaseDelay(-1)"
                  [disabled]="savingReleaseDelay()"
                  class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-primary dark:bg-dark-bg-primary text-light-font dark:text-dark-font cursor-pointer hover:border-accent-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Remove 1 week delay
                </button>
              }
            }
          </div>
          @if (showReleaseDelayControls()) {
            <div id="release-delay-feedback" class="mt-3 text-sm" aria-live="polite">
              @if (currentSeason(); as season) {
                <p>
                  Season {{ season.seasonNumber }} release delay:
                  @if (snoozeCount() === 0) {
                    no added delay
                  } @else {
                    {{ snoozeCount() }} {{ snoozeCount() === 1 ? 'week' : 'weeks' }}
                  }
                </p>
              }
              @if (estimatedAirDate(); as airDate) {
                <p>Pending episode air date (estimate): {{ airDate | date: 'mediumDate' }}</p>
              }
              @if (!canSnooze()) {
                <p>
                  @if (!estimatedAirDate()) {
                    Set this season's first episode air date to snooze its release schedule.
                    <a [routerLink]="['/items', currentItem.id, 'edit']" class="text-accent-primary"
                      >Edit season details</a
                    >
                  } @else {
                    This season's release delay cannot be increased further.
                  }
                </p>
              }
              @if (releaseDelayError()) {
                <p role="alert" class="text-accent-danger">{{ releaseDelayError() }}</p>
              }
            </div>
          }
        </section>

        <section>
          <h2 class="text-xl mb-3">Watch History</h2>
          @if (watchHistory().length === 0) {
            <p
              class="p-8 text-center bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border"
            >
              No watch history yet.
            </p>
          } @else {
            <ol class="space-y-2 list-none p-0 m-0">
              @for (entry of watchHistory(); track entry.date) {
                <li
                  class="flex items-center gap-4 px-5 py-3 bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg border border-light-border dark:border-dark-border"
                >
                  <span>{{ entry.date | date: 'medium' }}</span>
                  @if (entry.season) {
                    <span
                      class="text-xs bg-accent-primary/10 text-accent-primary px-2 py-0.5 rounded-full font-medium"
                      >S{{ entry.season }}E{{ entry.episode }}</span
                    >
                  }
                </li>
              }
            </ol>
          }
        </section>
      } @else {
        <div class="text-center px-8 py-16">
          <h2 class="mb-4">Item not found</h2>
          <a [routerLink]="['/items']">Back to Items</a>
        </div>
      }
    </div>
  `,
})
export class ItemViewComponent {
  private route = inject(ActivatedRoute);
  private imageStorage = inject(ImageStorageService);
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);
  private destroyRef = inject(DestroyRef);
  private destroyed = false;

  private readonly quickActionsByStatus: Record<
    ItemStatus,
    readonly { label: string; action: QuickAction }[]
  > = {
    'not-started': [
      { label: 'Mark Watched', action: 'watched' },
      { label: 'Start', action: 'started' },
      { label: 'Drop', action: 'dropped' },
    ],
    'in-progress': [
      { label: 'Mark Watched', action: 'watched' },
      { label: 'Pause', action: 'paused' },
      { label: 'Drop', action: 'dropped' },
    ],
    paused: [
      { label: 'Resume', action: 'started' },
      { label: 'Drop', action: 'dropped' },
    ],
    completed: [{ label: 'Start', action: 'started' }],
    dropped: [{ label: 'Start', action: 'started' }],
  };

  readonly paramMap = toSignal(this.route.paramMap);

  readonly item = computed<Item | null>(() => {
    const id = this.paramMap()?.get('id');
    return id ? (this.watchListService.items().find((item) => item.id === id) ?? null) : null;
  });
  readonly groupName = computed(() => {
    const item = this.item();
    return item
      ? (this.groupService.groups().find((group) => group.id === item.groupId)?.name ?? null)
      : null;
  });
  readonly lastWatchedDate = computed(() => {
    const item = this.item();
    return item && this.hasWatchHistory() ? getMostRecentWatchDate(item) : '';
  });
  readonly hasWatchHistory = computed(() => (this.item()?.watchHistory.length ?? 0) > 0);
  readonly posterUrl = signal(getPlaceholderUrl());
  readonly watchHistory = computed(() =>
    [...(this.item()?.watchHistory ?? [])].sort(
      (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
    ),
  );
  readonly quickActions = computed(() => {
    const item = this.item();
    if (!item) return [];

    return this.quickActionsByStatus[item.status];
  });
  readonly showReleaseDelayControls = computed(() => {
    const item = this.item();
    return !!item && isEpisodicType(item.type) && item.status === 'in-progress';
  });
  readonly currentSeason = computed(() => {
    const item = this.item();
    return item ? getCurrentSeason(item) : undefined;
  });
  readonly snoozeCount = computed(() => this.currentSeason()?.snoozeCount ?? 0);
  readonly estimatedAirDate = computed(() => {
    const item = this.item();
    return item ? getCurrentEpisodeAirDate(item) : null;
  });
  readonly canSnooze = computed(() => {
    const item = this.item();
    return !!item && canSnoozeCurrentSeason(item);
  });
  readonly canRemoveDelay = computed(
    () => isValidSnoozeCount(this.snoozeCount()) && this.snoozeCount() > 0,
  );
  readonly savingReleaseDelay = signal(false);
  readonly releaseDelayError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const version = this.imageStorage.version();
      void this.loadPoster(this.item()?.posterId, version);
    });
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  runAction(action: QuickAction): void {
    const item = this.item();
    if (!item) return;

    if (action === 'watched') this.watchListService.markWatched(item.id);
    else if (action === 'started') this.watchListService.markStarted(item.id);
    else if (action === 'paused') this.watchListService.markPaused(item.id);
    else this.watchListService.markDropped(item.id);
  }

  async changeReleaseDelay(change: 1 | -1): Promise<void> {
    const item = this.item();
    if (!item || !this.showReleaseDelayControls() || this.savingReleaseDelay()) return;
    if (change === 1 ? !this.canSnooze() : !this.canRemoveDelay()) return;
    this.savingReleaseDelay.set(true);
    this.releaseDelayError.set(null);
    try {
      if (change === 1) await this.watchListService.snoozeOneWeek(item.id);
      else await this.watchListService.removeOneWeekDelay(item.id);
    } catch {
      this.releaseDelayError.set('Could not save the release delay. Please try again.');
    } finally {
      this.savingReleaseDelay.set(false);
    }
  }

  private async loadPoster(id: string | undefined, loadedVersion: number): Promise<void> {
    const url = await this.imageStorage.getUrl(id);
    if (this.destroyed || id !== this.item()?.posterId) {
      return;
    }
    if (loadedVersion !== this.imageStorage.version()) return;

    this.posterUrl.set(url ?? getPlaceholderUrl());
  }
}
