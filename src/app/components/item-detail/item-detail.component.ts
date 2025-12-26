import { Component, OnInit, signal } from '@angular/core';
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
  imports: [CommonModule, FormsModule, RouterLink, ProgressBarComponent, TimeAgoComponent],
  template: `
    <div class="item-detail-container">
      <div *ngIf="item(); else notFound">
        <div class="header">
          <h1>{{ item()!.title }}</h1>
          <div class="actions">
            <button (click)="markWatched()" [disabled]="item()!.status === 'completed'" class="action-btn">
              Mark Watched
            </button>
            <button (click)="markCompleted()" [disabled]="item()!.status === 'completed'" class="action-btn">
              Mark Completed
            </button>
            <button (click)="deleteItem()" class="action-btn delete">Delete</button>
          </div>
        </div>

        <div class="item-info">
          <div class="info-row">
            <span class="label">Type:</span>
            <span class="value">{{ item()!.type }}</span>
          </div>
          <div class="info-row">
            <span class="label">Status:</span>
            <span class="value status" [class]="'status-' + item()!.status">
              {{ item()!.status }}
            </span>
          </div>
          <div class="info-row">
            <span class="label">Group:</span>
            <span class="value">{{ getGroupName(item()!.groupId) }}</span>
          </div>
          <div class="info-row" *ngIf="item()!.type === 'series' && item()!.progress">
            <span class="label">Progress:</span>
            <span class="value">
              Episode {{ item()!.progress!.episode }}
              <span *ngIf="item()!.progress!.totalEpisodes"> of {{ item()!.progress!.totalEpisodes }}</span>
            </span>
          </div>
          <div class="info-row" *ngIf="progressPercent() !== null">
            <span class="label">Completion:</span>
            <span class="value">{{ progressPercent() }}%</span>
            <app-progress-bar [percentage]="progressPercent()!" />
          </div>
          <div class="info-row">
            <span class="label">Last Watched:</span>
            <span class="value">
              <app-time-ago [date]="item()!.lastWatchedAt" />
            </span>
          </div>
          <div class="info-row">
            <span class="label">Created:</span>
            <span class="value">{{ formatDate(item()!.createdAt) }}</span>
          </div>
        </div>

        <div class="edit-section">
          <h2>Edit Item</h2>
          <form (ngSubmit)="saveChanges()">
            <div class="form-group">
              <label>Title:</label>
              <input type="text" [(ngModel)]="editTitle" name="title" required />
            </div>
            <div class="form-group">
              <label>Type:</label>
              <select [(ngModel)]="editType" name="type" (change)="onTypeChange()">
                <option value="series">Series</option>
                <option value="movie">Movie</option>
              </select>
            </div>
            <div class="form-group">
              <label>Group:</label>
              <select [(ngModel)]="editGroupId" name="groupId">
                <option *ngFor="let group of groups()" [value]="group.id">
                  {{ group.name }}
                </option>
              </select>
            </div>
            <div class="form-group" *ngIf="editType === 'series'">
              <label>Season:</label>
              <input type="number" [(ngModel)]="editSeason" name="season" min="1" />
            </div>
            <div class="form-group" *ngIf="editType === 'series'">
              <label>Episode:</label>
              <input type="number" [(ngModel)]="editEpisode" name="episode" min="0" />
            </div>
            <div class="form-group" *ngIf="editType === 'series'">
              <label>Total Episodes (optional):</label>
              <input type="number" [(ngModel)]="editTotalEpisodes" name="totalEpisodes" min="1" />
            </div>
            <div class="form-actions">
              <button type="submit" class="save-btn">Save Changes</button>
              <button type="button" (click)="cancelEdit()" class="cancel-btn">Cancel</button>
            </div>
          </form>
        </div>
      </div>
      <ng-template #notFound>
        <div class="not-found">
          <h2>Item not found</h2>
          <a [routerLink]="['/items']">Back to Items</a>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .item-detail-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    h1 {
      font-size: 2rem;
      margin: 0;
      color: #333;
    }

    .actions {
      display: flex;
      gap: 0.5rem;
    }

    .action-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
    }

    .action-btn:hover:not(:disabled) {
      background: #f8f9fa;
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .action-btn.delete {
      background: #dc3545;
      color: white;
      border-color: #dc3545;
    }

    .action-btn.delete:hover {
      background: #c82333;
    }

    .item-info {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .info-row:last-child {
      margin-bottom: 0;
    }

    .label {
      font-weight: 500;
      min-width: 120px;
      color: #666;
    }

    .value {
      flex: 1;
    }

    .status {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-weight: 500;
      text-transform: capitalize;
    }

    .status-not-started {
      background: #fff3cd;
      color: #856404;
    }

    .status-in-progress {
      background: #d1ecf1;
      color: #0c5460;
    }

    .status-completed {
      background: #d4edda;
      color: #155724;
    }

    .edit-section {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 1.5rem;
    }

    .edit-section h2 {
      margin-top: 0;
      margin-bottom: 1.5rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .form-group input,
    .form-group select {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }

    .form-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1.5rem;
    }

    .save-btn {
      padding: 0.75rem 1.5rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }

    .save-btn:hover {
      background: #0056b3;
    }

    .cancel-btn {
      padding: 0.75rem 1.5rem;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .cancel-btn:hover {
      background: #5a6268;
    }

    .not-found {
      text-align: center;
      padding: 4rem 2rem;
    }

    .not-found h2 {
      margin-bottom: 1rem;
    }
  `]
})
export class ItemDetailComponent implements OnInit {
  item = signal<Item | null>(null);
  groups = signal<Group[]>([]);
  
  editTitle = '';
  editType: ItemType = 'series';
  editGroupId = '';
  editSeason = 1;
  editEpisode = 0;
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
      this.editEpisode = 0;
      this.editTotalEpisodes = undefined;
    }
  }

  saveChanges(): void {
    const currentItem = this.item();
    if (!currentItem) return;

    const updated: Item = {
      ...currentItem,
      title: this.editTitle,
      type: this.editType,
      groupId: this.editGroupId,
      progress: this.editType === 'series' ? {
        season: this.editSeason,
        episode: this.editEpisode,
        totalEpisodes: this.editTotalEpisodes
      } : undefined
    };

    this.watchListService.updateItem(updated);
    this.item.set(updated);
  }

  cancelEdit(): void {
    this.loadEditData();
  }

  markWatched(): void {
    const currentItem = this.item();
    if (currentItem) {
      this.watchListService.markWatched(currentItem.id);
      const updated = this.watchListService.getItemById(currentItem.id);
      if (updated) {
        this.item.set(updated);
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
      }
    }
  }

  deleteItem(): void {
    if (confirm('Are you sure you want to delete this item?')) {
      const currentItem = this.item();
      if (currentItem) {
        this.watchListService.deleteItem(currentItem.id);
        this.router.navigate(['/items']);
      }
    }
  }

  progressPercent(): number | null {
    const currentItem = this.item();
    return currentItem ? this.watchListService.calculateProgress(currentItem) : null;
  }

  getGroupName(groupId: string): string {
    const group = this.groupService.getGroupById(groupId);
    return group ? group.name : 'Unknown';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }
}

