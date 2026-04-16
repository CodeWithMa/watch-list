import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WatchListService, HistoryEntry } from '../../services/watch-list.service';
import { DateFormatPipe } from '../../pipes/date-format.pipe';
import { TimeFormatPipe } from '../../pipes/time-format.pipe';

@Component({
  selector: 'app-watch-history',
  imports: [CommonModule, RouterLink, DateFormatPipe, TimeFormatPipe],
  template: `
    <div class="max-w-[800px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Watch History</h1>

      <div *ngIf="history().length === 0; else hasHistory" class="text-center p-16 bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg">
        <p class="text-light-font-secondary dark:text-dark-font-secondary mb-2">No watch history yet.</p>
        <p class="text-light-font-secondary dark:text-dark-font-secondary mb-2">Start watching to see your history here!</p>
        <a [routerLink]="['/items']" class="inline-block mt-4 px-6 py-3 bg-accent-primary text-white no-underline rounded font-medium hover:bg-accent-primary-hover">Browse Items</a>
      </div>

      <ng-template #hasHistory>
        <div class="relative">
          <div *ngFor="let entry of history(); let i = index" class="flex items-start mb-6 relative [&:not(:last-child)]:after:content-[''] [&:not(:last-child)]:after:absolute [&:not(:last-child)]:after:left-[100px] [&:not(:last-child)]:after:top-6 [&:not(:last-child)]:after:bottom-[-1.5rem] [&:not(:last-child)]:after:w-0.5 [&:not(:last-child)]:after:bg-light-border dark:[&:not(:last-child)]:after:bg-dark-border max-sm:[&:not(:last-child)]:after:left-[75px]">
            <div class="min-w-[100px] text-right pr-4 max-sm:min-w-[70px] max-sm:text-sm">
              <span class="block font-medium text-light-font dark:text-dark-font">{{ entry.date | dateFormat }}</span>
              <span class="block text-sm text-light-font-muted dark:text-dark-font-muted">{{ entry.date | timeFormat }}</span>
            </div>
            <div class="w-3 h-3 rounded-full bg-accent-primary my-1 mx-4 shrink-0 relative z-1 max-sm:mx-2"></div>
            <div class="flex-1 bg-light-bg-secondary dark:bg-dark-bg-secondary p-4 rounded-lg border border-light-border dark:border-dark-border">
              <a [routerLink]="['/items', entry.itemId]" class="font-medium text-light-font dark:text-dark-font no-underline mr-2 hover:text-accent-primary">
                {{ entry.itemTitle }}
              </a>
              <span class="text-sm text-light-font-muted dark:text-dark-font-muted capitalize mr-2">{{ entry.itemType }}</span>
              <span *ngIf="entry.itemType === 'series'" class="text-sm bg-light-bg-tertiary dark:bg-dark-bg-tertiary px-2 py-0.5 rounded font-medium">
                S{{ entry.season }}E{{ entry.episode }}
              </span>
            </div>
          </div>
        </div>
      </ng-template>
    </div>
  `
})
export class WatchHistoryComponent implements OnInit {
  history = signal<HistoryEntry[]>([]);

  constructor(private watchListService: WatchListService) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.history.set(this.watchListService.getAllWatchHistory());
  }
}
