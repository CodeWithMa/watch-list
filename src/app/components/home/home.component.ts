import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RoundRobinService } from '../../services/round-robin.service';
import { WatchListService } from '../../services/watch-list.service';
import { ItemCardComponent } from '../item-card/item-card.component';
import { ReadonlyItem as Item, ItemType } from '../../models/item.model';
import { isEpisodicType } from '../../domain/item.constants';
import { ProviderSettingsService } from '../../services/provider-settings.service';
import { watchActionFailure } from '../watch-action-feedback';
import { MutationFeedback } from '../mutation-feedback';
import { ConflictRecoveryComponent } from '../conflict-recovery/conflict-recovery.component';

@Component({
  selector: 'app-home',
  imports: [ItemCardComponent, CommonModule, RouterLink, ConflictRecoveryComponent],
  template: `
    <div>
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">What should I watch now?</h1>
      <app-conflict-recovery [disabled]="actions.busy()" (recovered)="actions.error.set(null)" />
      @if (actions.error()) {
        <p role="alert" class="mb-4 text-sm text-accent-danger">{{ actions.error() }}</p>
      }
      @if (actions.sessionSuccess()) {
        <p role="status" class="mb-4 text-sm">Changed for this session only; not saved to disk.</p>
      }

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 justify-items-center">
        <div class="w-full max-w-[280px] justify-self-center">
          <h2
            class="text-center text-sm font-semibold tracking-wide uppercase mb-3 text-light-font-secondary dark:text-dark-font-secondary"
          >
            Next Series
          </h2>
          @if (nextSeries()) {
            <div class="w-full">
              <!-- Narrow card (280px) keeps natural 2/3 poster (~420px tall) fully visible, no cropping -->
              <app-item-card [item]="nextSeries()!" />
              <div class="flex flex-wrap justify-center gap-2 mt-3">
                <button
                  (click)="markItem(nextSeries, 'watched')"
                  [disabled]="actions.busy()"
                  class="px-3 py-1.5 border border-transparent rounded bg-accent-primary text-white cursor-pointer text-xs font-medium hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mark Watched
                </button>
                <button
                  (click)="markItem(nextSeries, 'paused')"
                  [disabled]="actions.busy()"
                  class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-xs hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pause
                </button>
                <button
                  (click)="markItem(nextSeries, 'dropped')"
                  [disabled]="actions.busy()"
                  class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-xs hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Drop
                </button>
              </div>
            </div>
          } @else {
            <p
              class="w-full p-6 text-center text-sm rounded-lg border border-dashed border-light-border dark:border-dark-border text-light-font-muted dark:text-dark-font-muted"
            >
              @if (hasSeries()) {
                @if (hasInProgressSeries()) {
                  No aired series episodes available
                } @else {
                  No series currently being watched
                }
              } @else {
                No series in your watch list
              }
            </p>
          }
        </div>

        <div class="w-full max-w-[280px] justify-self-center">
          <h2
            class="text-center text-sm font-semibold tracking-wide uppercase mb-3 text-light-font-secondary dark:text-dark-font-secondary"
          >
            Next Movie
          </h2>
          @if (nextMovie()) {
            <div class="w-full">
              <app-item-card [item]="nextMovie()!" />
              <div class="flex flex-wrap justify-center gap-2 mt-3">
                <button
                  (click)="markItem(nextMovie, 'watched')"
                  [disabled]="actions.busy()"
                  class="px-3 py-1.5 border border-transparent rounded bg-accent-primary text-white cursor-pointer text-xs font-medium hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mark Watched
                </button>
                <button
                  (click)="markItem(nextMovie, 'paused')"
                  [disabled]="actions.busy()"
                  class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-xs hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pause
                </button>
                <button
                  (click)="markItem(nextMovie, 'dropped')"
                  [disabled]="actions.busy()"
                  class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-xs hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Drop
                </button>
              </div>
            </div>
          } @else {
            <p
              class="w-full p-6 text-center text-sm rounded-lg border border-dashed border-light-border dark:border-dark-border text-light-font-muted dark:text-dark-font-muted"
            >
              @if (hasMovies()) {
                No movies currently being watched
              } @else {
                No movies in your watch list
              }
            </p>
          }
        </div>
      </div>

      <div class="border-t border-light-border dark:border-dark-border pt-8 mt-8">
        <h2 class="text-xl mb-4 text-light-font-secondary dark:text-dark-font-secondary">
          Backlog
        </h2>
        @if (backlogItems().length > 0) {
          <div
            class="overflow-hidden rounded-lg border border-light-border dark:border-dark-border bg-light-bg-secondary dark:bg-dark-bg-secondary shadow-light dark:shadow-dark"
          >
            @for (item of backlogItems(); track item.id) {
              <div
                class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between border-b border-light-border dark:border-dark-border last:border-b-0"
              >
                <div class="min-w-0 flex items-center gap-3">
                  <a
                    [routerLink]="['/items', item.id]"
                    class="truncate no-underline text-base font-medium text-light-font dark:text-dark-font hover:text-accent-primary"
                    >{{ item.title }}</a
                  >
                  <span
                    class="shrink-0 rounded-full bg-light-bg-tertiary dark:bg-dark-bg-tertiary px-2 py-1 text-xs capitalize text-light-font-secondary dark:text-dark-font-secondary"
                    >{{ item.type }}</span
                  >
                </div>
                <div class="flex shrink-0 gap-2">
                  <button
                    (click)="startBacklogItem(item.id)"
                    [disabled]="actions.busy()"
                    class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add to currently watching
                  </button>
                  <button
                    (click)="dropBacklogItem(item.id)"
                    [disabled]="actions.busy()"
                    class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Drop
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <p
            class="p-8 text-center text-light-font-muted dark:text-dark-font-muted bg-light-bg-primary dark:bg-dark-bg-primary rounded-lg"
          >
            No items in backlog
          </p>
        }
      </div>

      <div class="border-t border-light-border dark:border-dark-border pt-8 mt-8">
        <h2 class="text-xl mb-4 text-light-font-secondary dark:text-dark-font-secondary">Paused</h2>
        @if (pausedItems().length > 0) {
          <div
            class="overflow-hidden rounded-lg border border-light-border dark:border-dark-border bg-light-bg-secondary dark:bg-dark-bg-secondary shadow-light dark:shadow-dark"
          >
            @for (item of pausedItems(); track item.id) {
              <div
                class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between border-b border-light-border dark:border-dark-border last:border-b-0"
              >
                <div class="min-w-0 flex items-center gap-3">
                  <a
                    [routerLink]="['/items', item.id]"
                    class="truncate no-underline text-base font-medium text-light-font dark:text-dark-font hover:text-accent-primary"
                    >{{ item.title }}</a
                  >
                  <span
                    class="shrink-0 rounded-full bg-light-bg-tertiary dark:bg-dark-bg-tertiary px-2 py-1 text-xs capitalize text-light-font-secondary dark:text-dark-font-secondary"
                    >{{ item.type }}</span
                  >
                </div>
                <div class="flex shrink-0 gap-2">
                  <button
                    (click)="resumePausedItem(item.id)"
                    [disabled]="actions.busy()"
                    class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Resume
                  </button>
                  <button
                    (click)="dropPausedItem(item.id)"
                    [disabled]="actions.busy()"
                    class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Drop
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <p
            class="p-8 text-center text-light-font-muted dark:text-dark-font-muted bg-light-bg-primary dark:bg-dark-bg-primary rounded-lg"
          >
            No items paused
          </p>
        }
      </div>
    </div>
  `,
})
export class HomeComponent {
  private roundRobinService = inject(RoundRobinService);
  private watchListService = inject(WatchListService);
  private providerSettings = inject(ProviderSettingsService);
  readonly actions = new MutationFeedback(watchActionFailure);

  nextSeries = this.roundRobinService.nextSeries;
  nextMovie = this.roundRobinService.nextMovie;
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

  markItem(
    getter: () => Item | null | undefined,
    action: 'watched' | 'completed' | 'dropped' | 'paused',
  ) {
    const item = getter();
    if (!item) return;
    return this.actions.run(() => {
      if (action === 'watched') return this.watchListService.markWatched(item.id);
      if (action === 'completed') return this.watchListService.markCompleted(item.id);
      if (action === 'dropped') return this.watchListService.markDropped(item.id);
      return this.watchListService.markPaused(item.id);
    }, 'Could not save the watch action.');
  }

  startBacklogItem(itemId: string) {
    return this.actions.run(
      () => this.watchListService.markStarted(itemId),
      'Could not start the item.',
    );
  }

  dropBacklogItem(itemId: string) {
    return this.actions.run(
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
