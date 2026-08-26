import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RoundRobinService } from '../../services/round-robin.service';
import { WatchListService } from '../../services/watch-list.service';
import { ItemCardComponent } from '../item-card/item-card.component';
import { Item, ItemType } from '../../models/item.model';
import { isEpisodicType } from '../../domain/item.constants';

@Component({
  selector: 'app-home',
  imports: [ItemCardComponent, CommonModule, RouterLink],
  template: `
    <div class="max-w-[1200px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">What should I watch now?</h1>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div>
          <h2 class="text-xl mb-4 text-light-font-secondary dark:text-dark-font-secondary">
            Next Series
          </h2>
          @if (nextSeries()) {
            <div class="mb-4">
              <app-item-card [item]="nextSeries()!" />
              <div class="flex gap-2 mt-3">
                <button
                  (click)="markItem(nextSeries, 'watched')"
                  class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
                >
                  Mark Watched
                </button>
                <button
                  (click)="markItem(nextSeries, 'completed')"
                  class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
                >
                  Mark Completed
                </button>
                <button
                  (click)="markItem(nextSeries, 'paused')"
                  class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
                >
                  Pause
                </button>
                <button
                  (click)="markItem(nextSeries, 'dropped')"
                  class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
                >
                  Drop
                </button>
              </div>
            </div>
          } @else {
            <p
              class="p-8 text-center text-light-font-muted dark:text-dark-font-muted bg-light-bg-primary dark:bg-dark-bg-primary rounded-lg"
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

        <div>
          <h2 class="text-xl mb-4 text-light-font-secondary dark:text-dark-font-secondary">
            Next Movie
          </h2>
          @if (nextMovie()) {
            <div class="mb-4">
              <app-item-card [item]="nextMovie()!" />
              <div class="flex gap-2 mt-3">
                <button
                  (click)="markItem(nextMovie, 'watched')"
                  class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
                >
                  Mark Watched
                </button>
                <button
                  (click)="markItem(nextMovie, 'completed')"
                  class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
                >
                  Mark Completed
                </button>
                <button
                  (click)="markItem(nextMovie, 'paused')"
                  class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
                >
                  Pause
                </button>
                <button
                  (click)="markItem(nextMovie, 'dropped')"
                  class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
                >
                  Drop
                </button>
              </div>
            </div>
          } @else {
            <p
              class="p-8 text-center text-light-font-muted dark:text-dark-font-muted bg-light-bg-primary dark:bg-dark-bg-primary rounded-lg"
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
                    class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
                  >
                    Add to currently watching
                  </button>
                  <button
                    (click)="dropBacklogItem(item.id)"
                    class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
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
                    class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
                  >
                    Resume
                  </button>
                  <button
                    (click)="dropPausedItem(item.id)"
                    class="px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer text-sm hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary"
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

  nextSeries = this.roundRobinService.nextSeries;
  nextMovie = this.roundRobinService.nextMovie;
  backlogItems = computed(() =>
    this.watchListService
      .items()
      .filter((item) => item.status === 'not-started')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  );

  pausedItems = computed(() =>
    this.watchListService
      .items()
      .filter((item) => item.status === 'paused')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  );

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
  ): void {
    const item = getter();
    if (!item) return;
    if (action === 'watched') this.watchListService.markWatched(item.id);
    else if (action === 'completed') this.watchListService.markCompleted(item.id);
    else if (action === 'dropped') this.watchListService.markDropped(item.id);
    else this.watchListService.markPaused(item.id);
  }

  startBacklogItem(itemId: string): void {
    this.watchListService.markStarted(itemId);
  }

  dropBacklogItem(itemId: string): void {
    this.watchListService.markDropped(itemId);
  }

  resumePausedItem(itemId: string): void {
    this.watchListService.markStarted(itemId);
  }

  dropPausedItem(itemId: string): void {
    this.watchListService.markDropped(itemId);
  }

  private hasItemType(type: ItemType): boolean {
    return this.watchListService.items().some((item) => item.type === type);
  }
}
