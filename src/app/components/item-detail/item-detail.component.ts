import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { Item, ItemType } from '../../models/item.model';
import { Group } from '../../models/group.model';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
import { TimeAgoComponent } from '../time-ago/time-ago.component';

@Component({
  selector: 'app-item-detail',
  imports: [CommonModule, FormsModule, RouterLink, TimeAgoComponent],
  template: `
    <div class="max-w-[800px] mx-auto p-8">
      @if (item()) {
        <div class="mb-6">
          <div class="flex justify-between items-start mb-3">
            <div>
              <h1 class="text-2xl m-0 text-light-font dark:text-dark-font">{{ item()!.title }}
                <span class="text-sm px-2 py-1 rounded font-medium capitalize ml-2" [ngClass]="{
                  'bg-status-not-started-bg-light dark:bg-status-not-started-bg-dark text-status-not-started-text-light dark:text-status-not-started-text-dark': item()!.status === 'not-started',
                  'bg-status-in-progress-bg-light dark:bg-status-in-progress-bg-dark text-status-in-progress-text-light dark:text-status-in-progress-text-dark': item()!.status === 'in-progress',
                  'bg-status-completed-bg-light dark:bg-status-completed-bg-dark text-status-completed-text-light dark:text-status-completed-text-dark': item()!.status === 'completed'
                }">
                  {{ item()!.status }}
                </span>
              </h1>
              <div class="text-sm text-light-font-secondary dark:text-dark-font-secondary mt-1">
                <span *ngIf="item()!.progress">Episode {{ item()!.progress!.episode }}<span *ngIf="item()!.progress!.totalEpisodes"> / {{ item()!.progress!.totalEpisodes }}</span> · </span>
                <span *ngIf="lastWatchedDate()">Last watched: <app-time-ago [date]="lastWatchedDate()" /> · </span>
                Created {{ formatDate(item()!.createdAt) }}
              </div>
            </div>
            <div class="flex gap-2">
              <button (click)="markWatched()" [disabled]="item()!.status === 'completed'" class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer hover:not-disabled:bg-light-bg-tertiary dark:hover:not-disabled:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed">
                Mark Watched
              </button>
              <button *ngIf="item()!.type === 'series'" (click)="markCompleted()" [disabled]="item()!.status === 'completed'" class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer hover:not-disabled:bg-light-bg-tertiary dark:hover:not-disabled:bg-dark-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed">
                Mark Completed
              </button>
              <ng-container *ngIf="!confirmDelete(); else confirmDeleteTemplate">
                <button (click)="confirmDelete.set(true)" class="px-4 py-2 border border-accent-danger rounded bg-accent-danger text-white cursor-pointer hover:bg-accent-danger-hover">Delete</button>
              </ng-container>
              <ng-template #confirmDeleteTemplate>
                <button (click)="deleteItem()" class="px-4 py-2 border border-accent-danger rounded bg-accent-danger text-white cursor-pointer hover:bg-accent-danger-hover animate-pulse">Confirm?</button>
                <button (click)="cancelDelete()" class="px-4 py-2 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer">Cancel</button>
              </ng-template>
            </div>
          </div>
        </div>

        <div class="border border-light-border dark:border-dark-border rounded-lg p-6">
          <h2 class="mt-0 mb-6">Edit Item</h2>
          <form (ngSubmit)="saveChanges()" #itemForm="ngForm">
            <div class="mb-4">
              <label class="block mb-2 font-medium">Title:</label>
              <input type="text" [(ngModel)]="editTitle" name="title" required class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]" />
              <div class="text-accent-danger text-sm mt-1" *ngIf="itemForm.controls['title']?.invalid && itemForm.controls['title']?.touched">
                Title is required
              </div>
            </div>
            <div class="mb-4">
              <label class="block mb-2 font-medium">Type:</label>
              <select [(ngModel)]="editType" name="type" (change)="onTypeChange()" class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]">
                <option value="series">Series</option>
                <option value="movie">Movie</option>
              </select>
            </div>
            <div class="mb-4">
              <label class="block mb-2 font-medium">Group:</label>
              <select [(ngModel)]="editGroupId" name="groupId" class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]">
                <option *ngFor="let group of groups()" [value]="group.id">
                  {{ group.name }}
                </option>
              </select>
            </div>
            <div class="mb-4" *ngIf="editType === 'series'">
              <label class="block mb-2 font-medium">Season:</label>
              <input type="number" [(ngModel)]="editSeason" name="season" min="1" class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]" />
            </div>
            <div class="mb-4" *ngIf="editType === 'series'">
              <label class="block mb-2 font-medium">Episode:</label>
              <input type="number" [(ngModel)]="editEpisode" name="episode" min="1" class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]" />
            </div>
            <div class="mb-4" *ngIf="editType === 'series'">
              <label class="block mb-2 font-medium">Total Episodes (optional):</label>
              <input type="number" [(ngModel)]="editTotalEpisodes" name="totalEpisodes" min="1" class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]" />
            </div>
            <div class="flex gap-2 mt-6">
              <button type="submit" class="px-6 py-3 bg-accent-primary text-white border-none rounded cursor-pointer font-medium hover:not-disabled:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed" [disabled]="itemForm.invalid">Save Changes</button>
              <button type="button" (click)="cancelEdit()" class="px-6 py-3 bg-accent-secondary text-white border-none rounded cursor-pointer hover:bg-accent-secondary-hover">Cancel</button>
            </div>
          </form>
        </div>
      } @else {
        <div class="text-center px-8 py-16">
          <h2 class="mb-4">Item not found</h2>
          <a [routerLink]="['/items']">Back to Items</a>
        </div>
      }
    </div>
  `
})
export class ItemDetailComponent implements OnInit {
  item = signal<Item | null>(null);
  groups = signal<Group[]>([]);
  confirmDelete = signal(false);
  
  editTitle = '';
  editType: ItemType = 'series';
  editGroupId = '';
  editSeason = 1;
  editEpisode = 1;
  editTotalEpisodes: number | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private watchListService: WatchListService,
    private groupService: GroupService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const item = this.watchListService.getItemById(id);
      if (item) {
        this.item.set(item);
        this.loadEditData();
      }
    }
    this.groups.set(this.groupService.getAllGroups());
  }

  loadEditData(): void {
    const currentItem = this.item();
    if (!currentItem) return;

    this.editTitle = currentItem.title;
    this.editType = currentItem.type;
    this.editGroupId = currentItem.groupId;
    
    if (currentItem.progress) {
      this.editSeason = currentItem.progress.season;
      this.editEpisode = currentItem.progress.episode;
      this.editTotalEpisodes = currentItem.progress.totalEpisodes;
    }
  }

  onTypeChange(): void {
    if (this.editType === 'movie') {
      this.editSeason = 1;
      this.editEpisode = 1;
      this.editTotalEpisodes = undefined;
    }
  }

  saveChanges(): void {
    const currentItem = this.item();
    if (!currentItem) return;
    if (!this.editTitle.trim()) return;

    const updated: Item = {
      ...currentItem,
      title: this.editTitle.trim(),
      type: this.editType,
      groupId: this.editGroupId,
      progress: this.editType === 'series' ? {
        season: this.editSeason,
        episode: this.editEpisode,
        totalEpisodes: this.editTotalEpisodes
      } : undefined
    };

    this.watchListService.updateItem(updated);
    this.router.navigate(['/items']);
  }

  cancelEdit(): void {
    this.loadEditData();
  }

  cancelDelete(): void {
    this.confirmDelete.set(false);
  }

  markWatched(): void {
    const currentItem = this.item();
    if (currentItem) {
      this.watchListService.markWatched(currentItem.id);
      const updated = this.watchListService.getItemById(currentItem.id);
      if (updated) {
        this.item.set(updated);
        this.loadEditData();
      }
    }
  }

  markCompleted(): void {
    const currentItem = this.item();
    if (currentItem) {
      this.watchListService.markCompleted(currentItem.id);
      const updated = this.watchListService.getItemById(currentItem.id);
      if (updated) {
        this.item.set(updated);
        this.loadEditData();
      }
    }
  }

  deleteItem(): void {
    const currentItem = this.item();
    if (currentItem) {
      this.watchListService.deleteItem(currentItem.id);
      this.router.navigate(['/items']);
    }
  }

  progressPercent = computed(() => {
    const currentItem = this.item();
    return currentItem ? this.watchListService.calculateProgress(currentItem) : null;
  });

  getGroupName(groupId: string): string {
    const group = this.groupService.getGroupById(groupId);
    return group ? group.name : 'Unknown';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  lastWatchedDate = computed(() => {
    const currentItem = this.item();
    return currentItem ? this.watchListService.getMostRecentWatchDate(currentItem) : '';
  });
}

