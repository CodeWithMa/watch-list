import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { ItemType } from '../../models/item.model';
import { Group } from '../../models/group.model';

@Component({
  selector: 'app-add-item',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="add-item-container">
      <h1>Add New Item</h1>
      
      <form (ngSubmit)="onSubmit()" class="add-item-form">
        <div class="form-group">
          <label for="title">Title *</label>
          <input 
            type="text" 
            id="title" 
            [(ngModel)]="title" 
            name="title" 
            required 
            class="form-control"
          />
        </div>

        <div class="form-group">
          <label for="type">Type *</label>
          <select 
            id="type" 
            [(ngModel)]="type" 
            name="type" 
            (change)="onTypeChange()"
            class="form-control"
          >
            <option value="series">Series</option>
            <option value="movie">Movie</option>
          </select>
        </div>

        <div class="form-group">
          <label for="groupId">Group *</label>
          <select 
            id="groupId" 
            [(ngModel)]="groupId" 
            name="groupId" 
            required
            class="form-control"
          >
            <option *ngFor="let group of groups()" [value]="group.id">
              {{ group.name }}
            </option>
          </select>
        </div>

        <div *ngIf="type === 'series'" class="series-fields">
          <div class="form-group">
            <label for="season">Season</label>
            <input 
              type="number" 
              id="season" 
              [(ngModel)]="season" 
              name="season" 
              min="1" 
              value="1"
              class="form-control"
            />
          </div>

          <div class="form-group">
            <label for="episode">Starting Episode</label>
            <input 
              type="number" 
              id="episode" 
              [(ngModel)]="episode" 
              name="episode" 
              min="1" 
              value="1"
              class="form-control"
            />
          </div>

          <div class="form-group">
            <label for="totalEpisodes">Total Episodes (optional)</label>
            <input 
              type="number" 
              id="totalEpisodes" 
              [(ngModel)]="totalEpisodes" 
              name="totalEpisodes" 
              min="1"
              class="form-control"
            />
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="submit-btn">Add Item</button>
          <button type="button" (click)="cancel()" class="cancel-btn">Cancel</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .add-item-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 2rem;
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 2rem;
      color: light-dark(var(--light-font-color), var(--dark-font-color));
    }

    .add-item-form {
      background: light-dark(var(--light-bg-tertiary), var(--dark-bg-tertiary));
      padding: 2rem;
      border-radius: 8px;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: light-dark(var(--light-font-color), var(--dark-font-color));
    }

    .form-control {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid light-dark(var(--light-border-color), var(--dark-border-color));
      border-radius: 4px;
      font-size: 1rem;
      box-sizing: border-box;
      background: light-dark(var(--light-bg-secondary), var(--dark-bg-secondary));
      color: light-dark(var(--light-font-color), var(--dark-font-color));
    }

    .form-control:focus {
      outline: none;
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }

    .series-fields {
      border-top: 1px solid light-dark(var(--light-border-color), var(--dark-border-color));
      padding-top: 1.5rem;
      margin-top: 1.5rem;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
    }

    .submit-btn {
      padding: 0.75rem 2rem;
      background: var(--accent-primary);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 500;
    }

    .submit-btn:hover {
      background: var(--accent-primary-hover);
    }

    .cancel-btn {
      padding: 0.75rem 2rem;
      background: var(--accent-secondary);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }

    .cancel-btn:hover {
      background: var(--accent-secondary-hover);
    }
  `]
})
export class AddItemComponent implements OnInit {
  groups = signal<Group[]>([]);
  
  title = '';
  type: ItemType = 'series';
  groupId = 'ungrouped';
  season = 1;
  episode = 1;
  totalEpisodes: number | undefined;

  constructor(
    private watchListService: WatchListService,
    private groupService: GroupService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.groups.set(this.groupService.getAllGroups());
    // Ensure ungrouped is selected by default
    if (this.groups().length > 0 && !this.groupId) {
      const ungrouped = this.groups().find(g => g.id === 'ungrouped');
      this.groupId = ungrouped ? ungrouped.id : this.groups()[0].id;
    }
  }

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

