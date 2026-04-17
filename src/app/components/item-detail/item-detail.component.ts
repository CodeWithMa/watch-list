import { Component, OnInit, signal, computed, inject } from '@angular/core';
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
              <span class="block mb-2 font-medium">Title:</span>
              <input type="text" [ngModel]="editTitle()" (ngModelChange)="editTitle.set($event)" name="title" required class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]" />
              @if (itemForm.controls['title']?.invalid && itemForm.controls['title']?.touched) {
                <div class="text-accent-danger text-sm mt-1">
                  Title is required
                </div>
              }
            </div>
     
            <div class="mb-4">
              <span class="block mb-2 font-medium">Status:</span>
              <div class="flex gap-4">
                <button type="button" role="button" tabindex="0"
                  (click)="editStatus.set('not-started')"
                  (keydown.enter)="editStatus.set('not-started')"
                  (keydown.space)="editStatus.set('not-started')"
                  class="px-4 py-2 rounded font-medium capitalize cursor-pointer border transition-all bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font border-light-border dark:border-dark-border hover:border-accent-primary"
                  [ngClass]="statusButtonClass('not-started')">
                  Not Started
                </button>
                <button type="button" role="button" tabindex="0"
                  (click)="editStatus.set('in-progress')"
                  (keydown.enter)="editStatus.set('in-progress')"
                  (keydown.space)="editStatus.set('in-progress')"
                  class="px-4 py-2 rounded font-medium capitalize cursor-pointer border transition-all bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font border-light-border dark:border-dark-border hover:border-accent-primary"
                  [ngClass]="statusButtonClass('in-progress')">
                  In Progress
                </button>
                <button type="button" role="button" tabindex="0"
                  (click)="editStatus.set('completed')"
                  (keydown.enter)="editStatus.set('completed')"
                  (keydown.space)="editStatus.set('completed')"
                  class="px-4 py-2 rounded font-medium capitalize cursor-pointer border transition-all bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font border-light-border dark:border-dark-border hover:border-accent-primary"
                  [ngClass]="statusButtonClass('completed')">
                  Completed
                </button>
              </div>
            </div>
     
            <div class="mb-4">
              <span class="block mb-2 font-medium">Type:</span>
              <select [ngModel]="editType()" (ngModelChange)="editType.set($event); onTypeChange()" class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]">
                <option value="series">Series</option>
                <option value="movie">Movie</option>
              </select>
            </div>
            <div class="mb-4">
              <label for="group-select" class="block mb-2 font-medium">Group:</label>
              <select id="group-select" [ngModel]="editGroupId()" (ngModelChange)="editGroupId.set($event)" name="groupId" class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]">
                @for (group of groups(); track group.id) {
                  <option [value]="group.id">
                    {{ group.name }}
                  </option>
                }
              </select>
            </div>
            @if (editType() === 'series') {
              <div class="mb-4">
                <span class="block mb-2 font-medium">Season:</span>
                <input type="number" [ngModel]="editSeason()" (ngModelChange)="editSeason.set($event ?? 1)" name="season" min="1" class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]" />
              </div>
              <div class="mb-4">
                <span class="block mb-2 font-medium">Episode:</span>
                <input type="number" [ngModel]="editEpisode()" (ngModelChange)="editEpisode.set($event ?? 1)" name="episode" min="1" class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]" />
              </div>
              <div class="mb-4">
                <span class="block mb-2 font-medium">Total Episodes (optional):</span>
                <input type="number" [ngModel]="editTotalEpisodes()" (ngModelChange)="editTotalEpisodes.set($event ?? undefined)" name="totalEpisodes" min="1" class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font box-border focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]" />
              </div>
            }
            @if (isDirty()) {
              <div class="mb-4 px-3 py-2 rounded bg-light-bg-secondary dark:bg-dark-bg-secondary border border-accent-secondary text-accent-secondary text-sm">
                You have unsaved changes
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);

  item = signal<Item | null>(null);
  groups = signal<Group[]>([]);
  confirmDelete = signal(false);
  
  editTitle = signal('');
  editStatus = signal<ItemStatus>('not-started');
  editType = signal<ItemType>('series');
  editGroupId = signal('');
  editSeason = signal(1);
  editEpisode = signal(1);
  editTotalEpisodes = signal<number | undefined>(undefined);

  private isProgressDirty = computed(() => {
    if (this.editType() !== 'series') return false;
    const item = this.item();
    if (!item) return false;
    const p = item.progress;
    return (
      this.editSeason() !== (p?.season ?? 1) ||
      this.editEpisode() !== (p?.episode ?? 1) ||
      this.editTotalEpisodes() !== p?.totalEpisodes
    );
  });

  isDirty = computed(() => {
    const item = this.item();
    if (!item) return false;
    return (
      this.editTitle() !== item.title ||
      this.editStatus() !== item.status ||
      this.editType() !== item.type ||
      this.editGroupId() !== item.groupId ||
      this.isProgressDirty()
    );
  });

  statusButtonClass(status: ItemStatus): Record<string, boolean> {
    const isSelected = this.editStatus() === status;
    const isNotStarted = status === 'not-started';
    const isInProgress = status === 'in-progress';
    const isCompleted = status === 'completed';
    
    return {
      'bg-status-not-started-bg-light dark:bg-status-not-started-bg-dark text-status-not-started-text-light dark:text-status-not-started-text-dark shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] border-transparent': isSelected && isNotStarted,
      'bg-status-in-progress-bg-light dark:bg-status-in-progress-bg-dark text-status-in-progress-text-light dark:text-status-in-progress-text-dark shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] border-transparent': isSelected && isInProgress,
      'bg-status-completed-bg-light dark:bg-status-completed-bg-dark text-status-completed-text-light dark:text-status-completed-text-dark shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] border-transparent': isSelected && isCompleted,
      'bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font border-light-border dark:border-dark-border hover:border-accent-primary': !isSelected
    };
  }

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

    this.editTitle.set(currentItem.title);
    this.editStatus.set(currentItem.status);
    this.editType.set(currentItem.type);
    this.editGroupId.set(currentItem.groupId);
    
    if (currentItem.progress) {
      this.editSeason.set(currentItem.progress.season);
      this.editEpisode.set(currentItem.progress.episode);
      this.editTotalEpisodes.set(currentItem.progress.totalEpisodes);
    } else {
      this.editSeason.set(1);
      this.editEpisode.set(1);
      this.editTotalEpisodes.set(undefined);
    }
  }

  onTypeChange(): void {
    if (this.editType() === 'movie') {
      this.editSeason.set(1);
      this.editEpisode.set(1);
      this.editTotalEpisodes.set(undefined);
    }
  }

  saveChanges(): void {
    const currentItem = this.item();
    if (!currentItem) return;
    if (!this.editTitle().trim()) return;

    const updated: Item = {
      ...currentItem,
      title: this.editTitle().trim(),
      status: this.editStatus(),
      type: this.editType(),
      groupId: this.editGroupId(),
      progress: this.editType() === 'series' ? {
        season: this.editSeason(),
        episode: this.editEpisode(),
        totalEpisodes: this.editTotalEpisodes()
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

