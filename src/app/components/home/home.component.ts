import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RoundRobinService } from '../../services/round-robin.service';
import { WatchListService } from '../../services/watch-list.service';
import { BacklogChoicesComponent } from './backlog-choices.component';
import { RecommendationPanelComponent } from './recommendation-panel.component';
import { TitleRowComponent } from './title-row.component';
import { ReadonlyItem as Item, ItemType } from '../../models/item.model';
import { isEpisodicType } from '../../domain/item.constants';
import { ProviderSettingsService } from '../../services/provider-settings.service';
import { watchActionFailure } from '../watch-action-feedback';
import { MutationFeedback } from '../mutation-feedback';
import { ConflictRecoveryComponent } from '../conflict-recovery/conflict-recovery.component';
import { deferralReturnDate } from '../../domain/availability-deferral';
import { WatchActionNoticeService } from '../watch-action-notice/watch-action-notice.service';

@Component({
  selector: 'app-home',
  imports: [
    BacklogChoicesComponent,
    CommonModule,
    ConflictRecoveryComponent,
    RecommendationPanelComponent,
    RouterLink,
    TitleRowComponent,
  ],
  template: `
    <div>
      <h1 class="page-title mb-4 sm:mb-6">What should I watch now?</h1>
      <app-conflict-recovery [disabled]="actions.busy()" (recovered)="actions.error.set(null)" />
      @if (actions.error()) {
        <p role="alert" class="mb-4 text-sm text-accent-danger-text">{{ actions.error() }}</p>
      }
      @if (actions.sessionSuccess()) {
        <p role="status" class="mb-4 text-sm">Changed for this session only; not saved to disk.</p>
      }

      @if (isLibraryEmpty()) {
        <section class="card p-6 sm:p-8 text-center">
          <h2 class="section-title mb-2">Your watch list is empty</h2>
          <p class="mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">
            Add a series or movie and this page will tell you what to watch next.
          </p>
          <a routerLink="/items/add" class="btn btn-primary">Add your first title</a>
        </section>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 sm:mb-8 items-start">
          <section>
            <h2 class="slot-label">Next Series</h2>
            @if (nextSeries(); as item) {
              <app-recommendation-panel
                [item]="item"
                [busy]="actions.busy()"
                (watched)="markItem(nextSeries, 'watched')"
                (deferred)="openDeferral()"
                (paused)="markItem(nextSeries, 'paused')"
                (dropped)="markItem(nextSeries, 'dropped')"
              >
                @if (deferringItem(); as target) {
                  <div class="mt-3 pt-3 border-t border-light-border dark:border-dark-border">
                    <p class="mt-0 mb-3 text-sm">
                      Hide {{ target.title }}'s current episode from recommendations until it's
                      available.
                    </p>
                    <label for="deferral-hours" class="block text-sm mb-1">Hours</label>
                    <input
                      #hoursInput
                      id="deferral-hours"
                      type="number"
                      min="1"
                      step="1"
                      [value]="deferralHours()"
                      (input)="deferralHours.set(hoursInput.value)"
                      [disabled]="actions.busy()"
                      aria-describedby="deferral-preview"
                      class="form-control-sm max-w-32"
                    />
                    <p id="deferral-preview" aria-live="polite" class="text-sm my-3">
                      @if (returnDate(); as until) {
                        Returns {{ until | date: 'short' }} (local time)
                      } @else {
                        Enter positive whole hours with a valid return date.
                      }
                    </p>
                    <div class="flex flex-wrap gap-2">
                      <button
                        type="button"
                        (click)="confirmDeferral()"
                        [disabled]="actions.busy() || !returnDate()"
                        class="btn btn-primary"
                      >
                        Confirm deferral
                      </button>
                      <button
                        type="button"
                        (click)="deferringItem.set(null)"
                        [disabled]="actions.busy()"
                        class="btn btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                }
              </app-recommendation-panel>
            } @else {
              <div class="card p-4">
                <p class="m-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
                  @if (allDeferredUntil(); as until) {
                    All aired episodes are temporarily deferred. Earliest return:
                    {{ until | date: 'short' }} (local time).
                  } @else if (hasSeries()) {
                    @if (hasInProgressSeries()) {
                      No aired series episodes available
                    } @else {
                      No series currently being watched
                    }
                  } @else {
                    No series in your watch list
                  }
                </p>
                <app-backlog-choices
                  [items]="backlogSeries()"
                  noun="series"
                  [busy]="actions.busy()"
                  (started)="startBacklogItem($event)"
                  (seeAll)="backlogSection.scrollIntoView()"
                />
              </div>
            }
          </section>

          <section>
            <h2 class="slot-label">Next Movie</h2>
            @if (nextMovie(); as item) {
              <app-recommendation-panel
                [item]="item"
                [busy]="actions.busy()"
                (watched)="markItem(nextMovie, 'watched')"
                (paused)="markItem(nextMovie, 'paused')"
                (dropped)="markItem(nextMovie, 'dropped')"
              />
            } @else {
              <div class="card p-4">
                <p class="m-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
                  @if (hasMovies()) {
                    No movies currently being watched
                  } @else {
                    No movies in your watch list
                  }
                </p>
                <app-backlog-choices
                  [items]="backlogMovies()"
                  noun="movie"
                  [busy]="actions.busy()"
                  (started)="startBacklogItem($event)"
                  (seeAll)="backlogSection.scrollIntoView()"
                />
              </div>
            }
          </section>
        </div>

        <section #backlogSection class="mb-6 sm:mb-8">
          @if (backlogItems().length > 0) {
            <h2 class="section-title mb-3">Backlog</h2>
            <div class="card overflow-hidden">
              @for (item of backlogItems(); track item.id) {
                <app-title-row
                  [item]="item"
                  actionLabel="Start"
                  [busy]="actions.busy()"
                  (started)="startBacklogItem(item.id)"
                  (dropped)="dropBacklogItem(item.id)"
                />
              }
            </div>
          } @else {
            <div class="flex flex-wrap items-baseline gap-x-3">
              <h2 class="section-title">Backlog</h2>
              <p class="m-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
                No items in backlog
              </p>
            </div>
          }
        </section>

        <section>
          @if (pausedItems().length > 0) {
            <h2 class="section-title mb-3">Paused</h2>
            <div class="card overflow-hidden">
              @for (item of pausedItems(); track item.id) {
                <app-title-row
                  [item]="item"
                  actionLabel="Resume"
                  [busy]="actions.busy()"
                  (started)="resumePausedItem(item.id)"
                  (dropped)="dropPausedItem(item.id)"
                />
              }
            </div>
          } @else {
            <div class="flex flex-wrap items-baseline gap-x-3">
              <h2 class="section-title">Paused</h2>
              <p class="m-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
                No items paused
              </p>
            </div>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .slot-label {
      margin: 0 0 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
    }
  `,
})
export class HomeComponent {
  private roundRobinService = inject(RoundRobinService);
  private watchListService = inject(WatchListService);
  private providerSettings = inject(ProviderSettingsService);
  private notices = inject(WatchActionNoticeService);
  readonly actions = new MutationFeedback(watchActionFailure);

  nextSeries = this.roundRobinService.nextSeries;
  nextMovie = this.roundRobinService.nextMovie;
  readonly allDeferredUntil = this.roundRobinService.allDeferredUntil;
  readonly deferringItem = signal<Item | null>(null);
  readonly deferralHours = signal('1');
  private readonly durationHours = computed(() =>
    /^\d+$/.test(this.deferralHours()) ? Number(this.deferralHours()) : NaN,
  );
  private readonly previewNow = signal(Date.now());
  readonly returnDate = computed(() => deferralReturnDate(this.durationHours(), this.previewNow()));

  constructor() {
    effect((onCleanup) => {
      if (!this.deferringItem()) return;
      // Keep the preview accurate if the duration chooser is left open.
      const timer = setInterval(() => this.previewNow.set(Date.now()), 1000);
      onCleanup(() => clearInterval(timer));
    });
  }

  openDeferral() {
    const item = this.nextSeries();
    if (!item || this.actions.busy()) return;
    this.deferralHours.set('1');
    this.previewNow.set(Date.now());
    this.deferringItem.set(item);
  }

  async confirmDeferral() {
    const item = this.deferringItem();
    const hours = this.durationHours();
    if (!item || !deferralReturnDate(hours)) return;
    const result = await this.notices.run(
      this.actions,
      () =>
        this.watchListService.deferEpisode(
          item.id,
          hours,
          item.progress ?? { season: 1, episode: 1 },
        ),
      'Could not save the availability deferral.',
    );
    if (result) this.deferringItem.set(null);
  }
  backlogItems = computed(() => {
    const adultMode = this.providerSettings.settings().adultDisplayMode;
    let items = this.watchListService.items().filter((item) => item.status === 'not-started');
    if (adultMode === 'hide') {
      items = items.filter((item) => !item.isAdult);
    }
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  pausedItems = computed(() => {
    const adultMode = this.providerSettings.settings().adultDisplayMode;
    let items = this.watchListService.items().filter((item) => item.status === 'paused');
    if (adultMode === 'hide') {
      items = items.filter((item) => !item.isAdult);
    }
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  protected hasSeries = computed(() =>
    this.watchListService.items().some((item) => isEpisodicType(item.type)),
  );
  protected hasMovies = computed(() => this.hasItemType('movie'));
  protected hasInProgressSeries = computed(
    () => this.watchListService.inProgressSeries().length > 0,
  );

  protected isLibraryEmpty = computed(() => this.watchListService.items().length === 0);
  protected backlogSeries = computed(() =>
    this.backlogItems().filter((item) => isEpisodicType(item.type)),
  );
  protected backlogMovies = computed(() =>
    this.backlogItems().filter((item) => item.type === 'movie'),
  );

  markItem(
    getter: () => Item | null | undefined,
    action: 'watched' | 'completed' | 'dropped' | 'paused',
  ) {
    const item = getter();
    if (!item) return;
    return this.notices.run(
      this.actions,
      () => {
        if (action === 'watched') return this.watchListService.markWatched(item.id);
        if (action === 'completed') return this.watchListService.markCompleted(item.id);
        if (action === 'dropped') return this.watchListService.markDropped(item.id);
        return this.watchListService.markPaused(item.id);
      },
      'Could not save the watch action.',
    );
  }

  startBacklogItem(itemId: string) {
    return this.notices.run(
      this.actions,
      () => this.watchListService.markStarted(itemId),
      'Could not start the item.',
    );
  }

  dropBacklogItem(itemId: string) {
    return this.notices.run(
      this.actions,
      () => this.watchListService.markDropped(itemId),
      'Could not drop the item.',
    );
  }

  resumePausedItem(itemId: string) {
    return this.startBacklogItem(itemId);
  }

  dropPausedItem(itemId: string) {
    return this.dropBacklogItem(itemId);
  }

  private hasItemType(type: ItemType): boolean {
    return this.watchListService.items().some((item) => item.type === type);
  }
}
