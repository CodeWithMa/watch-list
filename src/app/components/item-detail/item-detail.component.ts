import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { Item, ItemType, ItemStatus } from '../../models/item.model';
import { Group } from '../../models/group.model';

@Component({
  selector: 'app-item-detail',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="max-w-[800px] mx-auto p-8">
      @if (item()) {
        <div class="border border-light-border dark:border-dark-border rounded-lg p-6">
          <h2 class="mt-0 mb-6">Edit Item</h2>
          <form (ngSubmit)="saveChanges()" #itemForm="ngForm">
            <div class="mb-4">
              <label class="block mb-2 font-medium">Title:</label>
              <input type="text" [(ngModel)]="editTitle" name="title" required class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]" />
              @if (itemForm.controls['title']?.invalid && itemForm.controls['title']?.touched) {
                <div class="text-accent-danger text-sm mt-1">
                  Title is required
                </div>
              }
            </div>

            <div class="mb-4">
              <label class="block mb-2 font-medium">Status:</label>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" [(ngModel)]="editStatus" name="status" value="not-started" class="w-4 h-4 accent-accent-primary" />
                  <span class="px-2 py-1 rounded font-medium capitalize" [ngClass]="{
                    'bg-status-not-started-bg-light dark:bg-status-not-started-bg-dark text-status-not-started-text-light dark:text-status-not-started-text-dark': true
                  }">Not Started</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" [(ngModel)]="editStatus" name="status" value="in-progress" class="w-4 h-4 accent-accent-primary" />
                  <span class="px-2 py-1 rounded font-medium capitalize" [ngClass]="{
                    'bg-status-in-progress-bg-light dark:bg-status-in-progress-bg-dark text-status-in-progress-text-light dark:text-status-in-progress-text-dark': true
                  }">In Progress</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" [(ngModel)]="editStatus" name="status" value="completed" class="w-4 h-4 accent-accent-primary" />
                  <span class="px-2 py-1 rounded font-medium capitalize" [ngClass]="{
                    'bg-status-completed-bg-light dark:bg-status-completed-bg-dark text-status-completed-text-light dark:text-status-completed-text-dark': true
                  }">Completed</span>
                </label>
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
            @if (editType === 'series') {
              <div class="mb-4">
                <label class="block mb-2 font-medium">Season:</label>
                <input type="number" [(ngModel)]="editSeason" name="season" min="1" class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]" />
              </div>
              <div class="mb-4">
                <label class="block mb-2 font-medium">Episode:</label>
                <input type="number" [(ngModel)]="editEpisode" name="episode" min="1" class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]" />
              </div>
              <div class="mb-4">
                <label class="block mb-2 font-medium">Total Episodes (optional):</label>
                <input type="number" [(ngModel)]="editTotalEpisodes" name="totalEpisodes" min="1" class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]" />
              </div>
            }
            <div class="flex gap-2 mt-6">
              <button type="submit" class="px-6 py-3 bg-accent-primary text-white border-none rounded cursor-pointer font-medium hover:not-disabled:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed" [disabled]="itemForm.invalid">Save Changes</button>
              <button type="button" (click)="cancelEdit()" class="px-6 py-3 bg-accent-secondary text-white border-none rounded cursor-pointer hover:bg-accent-secondary-hover">Cancel</button>
            </div>
            <div class="flex gap-2 mt-4">
              @if (!confirmDelete()) {
                <button type="button" (click)="confirmDelete.set(true)" class="px-6 py-3 border border-accent-danger rounded bg-transparent text-accent-danger cursor-pointer hover:bg-accent-danger hover:text-white">Delete</button>
              } @else {
                <button type="button" (click)="deleteItem()" class="px-6 py-3 border border-accent-danger rounded bg-accent-danger text-white cursor-pointer hover:bg-accent-danger-hover animate-pulse">Confirm Delete?</button>
                <button type="button" (click)="cancelDelete()" class="px-6 py-3 bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font border border-light-border dark:border-dark-border rounded cursor-pointer">Cancel</button>
              }
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
  editStatus: ItemStatus = 'not-started';
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
    this.editStatus = currentItem.status;
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
      status: this.editStatus,
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

  deleteItem(): void {
    const currentItem = this.item();
    if (currentItem) {
      this.watchListService.deleteItem(currentItem.id);
      this.router.navigate(['/items']);
    }
  }
}

