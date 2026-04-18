import { Component, inject } from '@angular/core';

import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { ItemType } from '../../models/item.model';

@Component({
  selector: 'app-add-item',
  imports: [FormsModule],
  template: `
    <div class="max-w-[600px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Add New Item</h1>
    
      <form (ngSubmit)="onSubmit()" class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-8 rounded-lg">
        <div class="mb-6">
          <label for="title" class="block mb-2 font-medium text-light-font dark:text-dark-font">Title *</label>
          <input
            type="text"
            id="title"
            [(ngModel)]="title"
            name="title"
            required
            class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
            />
        </div>
    
        <div class="mb-6">
          <label for="type" class="block mb-2 font-medium text-light-font dark:text-dark-font">Type *</label>
          <select
            id="type"
            [(ngModel)]="type"
            name="type"
            (change)="onTypeChange()"
            class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
            >
            <option value="series">Series</option>
            <option value="movie">Movie</option>
          </select>
        </div>
    
        <div class="mb-6">
          <label for="groupId" class="block mb-2 font-medium text-light-font dark:text-dark-font">Group *</label>
          <select
            id="groupId"
            [(ngModel)]="groupId"
            name="groupId"
            required
            class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
            >
            @for (group of groups(); track group.id) {
              <option [value]="group.id">
                {{ group.name }}
              </option>
            }
          </select>
        </div>
    
        @if (type === 'series') {
          <div class="border-t border-light-border dark:border-dark-border pt-6 mt-6">
            <div class="mb-6">
              <label for="season" class="block mb-2 font-medium text-light-font dark:text-dark-font">Season</label>
              <input
                type="number"
                id="season"
                [(ngModel)]="season"
                name="season"
                min="1"
                value="1"
                class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
                />
            </div>
            <div class="mb-6">
              <label for="episode" class="block mb-2 font-medium text-light-font dark:text-dark-font">Starting Episode</label>
              <input
                type="number"
                id="episode"
                [(ngModel)]="episode"
                name="episode"
                min="1"
                value="1"
                class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
                />
            </div>
            <div class="mb-6">
              <label for="totalEpisodes" class="block mb-2 font-medium text-light-font dark:text-dark-font">Total Episodes (optional)</label>
              <input
                type="number"
                id="totalEpisodes"
                [(ngModel)]="totalEpisodes"
                name="totalEpisodes"
                min="1"
                class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
                />
            </div>
          </div>
        }
    
        <div class="flex gap-4 mt-8">
          <button type="submit" class="px-8 py-3 bg-accent-primary text-white border-none rounded cursor-pointer text-base font-medium hover:bg-accent-primary-hover">Add Item</button>
          <button type="button" (click)="cancel()" class="px-8 py-3 bg-accent-secondary text-white border-none rounded cursor-pointer text-base hover:bg-accent-secondary-hover">Cancel</button>
        </div>
      </form>
    </div>
    `
})
export class AddItemComponent {
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);
  private router = inject(Router);

  readonly groups = this.groupService.groups;

  title = '';
  type: ItemType = 'series';
  groupId = 'ungrouped';
  season = 1;
  episode = 1;
  totalEpisodes: number | undefined;

  onTypeChange(): void {
    if (this.type === 'movie') {
      this.season = 1;
      this.episode = 1;
      this.totalEpisodes = undefined;
    }
  }

  onSubmit(): void {
    if (!this.title.trim()) {
      return;
    }

    this.watchListService.addItem({
      title: this.title.trim(),
      type: this.type,
      groupId: this.groupId,
      status: 'not-started',
      progress: this.type === 'series' ? {
        season: this.season,
        episode: this.episode,
        totalEpisodes: this.totalEpisodes
      } : undefined
    });

    this.router.navigate(['/items']);
  }

  cancel(): void {
    this.router.navigate(['/items']);
  }
}

