import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { RoundRobinService } from '../../services/round-robin.service';
import { injectPosterUrl } from '../../services/poster-reader';
import { ReadonlyItem as Item, ItemStatus } from '../../models/item.model';
import { TimeAgoComponent } from '../time-ago/time-ago.component';
import { formatEpisode, getMostRecentWatchDate } from '../../utils/progress.utils';
import { getPlaceholderUrl } from '../../utils/tmdb-image.utils';
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS, isEpisodicType } from '../../domain/item.constants';
import { statusBadgeClass } from '../../utils/status.utils';
import { WatchActionNoticeService } from '../watch-action-notice/watch-action-notice.service';
import { watchActionFailure } from '../watch-action-feedback';
import { MutationFeedback } from '../mutation-feedback';
import { ConflictRecoveryComponent } from '../conflict-recovery/conflict-recovery.component';
import {
  canSnoozeCurrentSeason,
  getCurrentSeason,
  isValidSnoozeCount,
} from '../../domain/episode-release';

type QuickAction = 'watched' | 'started' | 'paused' | 'dropped';

@Component({
  selector: 'app-item-view',
  imports: [DatePipe, RouterLink, TimeAgoComponent, ConflictRecoveryComponent],
  template: `
    <div>
      <app-conflict-recovery [disabled]="actions.busy()" (recovered)="actions.error.set(null)" />
      @if (item(); as currentItem) {
        <div
          class="card p-4 sm:p-6 mb-6 grid grid-cols-[5.5rem_1fr] sm:grid-cols-[10rem_1fr] sm:grid-rows-[auto_1fr] gap-4 sm:gap-x-6"
        >
          <img
            [src]="posterUrl()"
            [alt]="currentItem.title + ' poster'"
            class="w-full aspect-[2/3] object-cover rounded sm:row-span-2"
          />
          <div class="min-w-0">
            <h1 class="page-title break-words">{{ currentItem.title }}</h1>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <span [class]="statusBadge()">{{ statusLabel() }}</span>
              <span class="text-xs text-light-font-secondary dark:text-dark-font-secondary">{{
                typeLabel()
              }}</span>
            </div>
            @if (episodeLabel(); as episode) {
              <p class="mt-3 mb-0 text-base">
                {{ progressLabel() }}: <strong class="font-semibold">{{ episode }}</strong>
                @if (currentSeason()?.totalEpisodes; as total) {
                  <span class="text-light-font-secondary dark:text-dark-font-secondary">
                    of {{ total }}</span
                  >
                }
              </p>
            }
          </div>

          <section
            class="col-span-2 sm:col-span-1 sm:col-start-2 min-w-0"
            aria-label="Quick actions"
          >
            @if (deferralUntil(); as until) {
              <div class="mb-3 p-3 border border-light-border dark:border-dark-border rounded">
                <p class="text-sm mt-0 mb-2">
                  Availability deferred until {{ until | date: 'short' }} (local time).
                </p>
                <button
                  type="button"
                  (click)="clearDeferral()"
                  [disabled]="actions.busy()"
                  class="btn btn-secondary"
                >
                  Clear deferral
                </button>
              </div>
            }
            <div class="flex flex-wrap gap-2">
              @for (action of quickActions(); track action.action; let first = $first) {
                <button
                  type="button"
                  (click)="runAction(action.action)"
                  [disabled]="actions.busy()"
                  class="btn"
                  [class.btn-primary]="first"
                  [class.btn-secondary]="!first && action.action !== 'dropped'"
                  [class.btn-quiet]="action.action === 'dropped'"
                  [class.max-sm:w-full]="first"
                >
                  {{ action.label }}
                </button>
              }
              @if (showReleaseDelayControls()) {
                <button
                  type="button"
                  (click)="changeReleaseDelay(1)"
                  [disabled]="actions.busy() || !canSnooze()"
                  [title]="snoozeHint()"
                  class="btn btn-secondary"
                >
                  Snooze 1 week
                </button>
                @if (canRemoveDelay()) {
                  <button
                    type="button"
                    (click)="changeReleaseDelay(-1)"
                    [disabled]="actions.busy()"
                    class="btn btn-secondary"
                  >
                    Remove 1 week delay
                  </button>
                }
              }
              <a [routerLink]="['/items', currentItem.id, 'edit']" class="btn btn-secondary"
                >Edit Item</a
              >
            </div>
            @if (actions.error()) {
              <p role="alert" class="mt-3 mb-0 text-sm text-accent-danger-text">
                {{ actions.error() }}
              </p>
            }
            @if (actions.sessionSuccess()) {
              <p role="status" class="mt-3 mb-0 text-sm">
                Changed for this session only; not saved to disk.
              </p>
            }
          </section>
        </div>

        <section class="mb-6">
          <h2 class="section-title mb-3">Details</h2>
          <dl class="card m-0 p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <dt class="text-light-font-secondary dark:text-dark-font-secondary">Type</dt>
              <dd class="m-0">{{ typeLabel() }}</dd>
            </div>
            <div>
              <dt class="text-light-font-secondary dark:text-dark-font-secondary">Group</dt>
              <dd class="m-0">{{ groupName() ?? 'Ungrouped' }}</dd>
            </div>
            <div>
              <dt class="text-light-font-secondary dark:text-dark-font-secondary">Added</dt>
              <dd class="m-0">{{ currentItem.createdAt | date: 'medium' }}</dd>
            </div>
            <div>
              <dt class="text-light-font-secondary dark:text-dark-font-secondary">Last watched</dt>
              <dd class="m-0">
                @if (hasWatchHistory()) {
                  <app-time-ago [date]="lastWatchedDate()" />
                } @else {
                  Never
                }
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 class="section-title mb-3">Watch History</h2>
          @if (watchHistory().length === 0) {
            <p class="card m-0 p-4 text-sm text-light-font-secondary dark:text-dark-font-secondary">
              No watch history yet.
            </p>
          } @else {
            <ol class="space-y-2 list-none p-0 m-0">
              @for (entry of watchHistory(); track $index) {
                <li class="card flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
                  <span>{{ entry.date | date: 'medium' }}</span>
                  @if (entry.season) {
                    <span
                      class="text-xs bg-accent-primary/10 text-accent-text px-2 py-0.5 rounded-full font-medium"
                      >{{ formatEpisode(entry) }}</span
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
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);
  private roundRobinService = inject(RoundRobinService);
  private notices = inject(WatchActionNoticeService);
  protected readonly formatEpisode = formatEpisode;

  private readonly quickActionsByStatus: Record<
    ItemStatus,
    readonly { label: string; action: QuickAction }[]
  > = {
    'not-started': [
      { label: 'Start', action: 'started' },
      { label: 'Mark Watched', action: 'watched' },
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
  private readonly storedPosterUrl = injectPosterUrl(() => this.item()?.posterId);
  readonly posterUrl = computed(() => this.storedPosterUrl() ?? getPlaceholderUrl());
  readonly watchHistory = computed(() =>
    [...(this.item()?.watchHistory ?? [])].sort(
      (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
    ),
  );
  readonly quickActions = computed(() => {
    const item = this.item();
    if (!item) return [];

    const episode = this.episodeLabel();
    const label = episode ? `Mark ${episode} watched` : 'Mark Watched';
    return this.quickActionsByStatus[item.status].map((action) =>
      action.action === 'watched' ? { ...action, label } : action,
    );
  });
  readonly statusBadge = computed(() => statusBadgeClass(this.item()?.status ?? 'not-started'));
  readonly statusLabel = computed(() => ITEM_STATUS_LABELS[this.item()?.status ?? 'not-started']);
  readonly typeLabel = computed(() => ITEM_TYPE_LABELS[this.item()?.type ?? 'series']);
  readonly episodeLabel = computed(() => {
    const item = this.item();
    return item?.progress && isEpisodicType(item.type) ? formatEpisode(item.progress) : null;
  });
  readonly progressLabel = computed(() =>
    ['completed', 'dropped'].includes(this.item()?.status ?? '') ? 'Progress' : 'Next episode',
  );
  readonly showReleaseDelayControls = computed(() => {
    const item = this.item();
    return !!item && isEpisodicType(item.type) && item.status === 'in-progress';
  });
  readonly deferralUntil = computed(() => {
    const item = this.item();
    return item ? this.roundRobinService.activeDeferralUntil(item) : null;
  });
  readonly currentSeason = computed(() => {
    const item = this.item();
    return item ? getCurrentSeason(item) : undefined;
  });
  readonly snoozeCount = computed(() => this.currentSeason()?.snoozeCount ?? 0);
  readonly canSnooze = computed(() => {
    const item = this.item();
    return !!item && canSnoozeCurrentSeason(item);
  });
  readonly snoozeHint = computed(() =>
    this.canSnooze()
      ? 'Shift the estimated release of the remaining episodes by one week'
      : "Add this season's first episode air date in Edit Item to enable snoozing",
  );
  readonly canRemoveDelay = computed(
    () => isValidSnoozeCount(this.snoozeCount()) && this.snoozeCount() > 0,
  );
  readonly actions = new MutationFeedback(watchActionFailure);

  clearDeferral() {
    const item = this.item();
    if (!item) return;
    return this.notices.run(
      this.actions,
      () => this.watchListService.clearDeferral(item.id),
      'Unable to clear the availability deferral.',
    );
  }

  runAction(action: QuickAction) {
    const item = this.item();
    if (!item) return;

    return this.notices.run(
      this.actions,
      () => {
        if (action === 'watched') return this.watchListService.markWatched(item.id);
        if (action === 'started') return this.watchListService.markStarted(item.id);
        if (action === 'paused') return this.watchListService.markPaused(item.id);
        return this.watchListService.markDropped(item.id);
      },
      'Could not save the watch action.',
    );
  }

  changeReleaseDelay(change: 1 | -1) {
    const item = this.item();
    if (!item || !this.showReleaseDelayControls()) return;
    if (change === 1 ? !this.canSnooze() : !this.canRemoveDelay()) return;
    return this.notices.run(
      this.actions,
      () =>
        change === 1
          ? this.watchListService.snoozeOneWeek(item.id)
          : this.watchListService.removeOneWeekDelay(item.id),
      'Could not save the release delay.',
    );
  }
}
