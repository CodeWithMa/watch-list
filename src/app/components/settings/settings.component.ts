import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { ImportExportService } from '../../services/import-export.service';
import { Settings } from '../../models/storage.model';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-container">
      <h1>Settings</h1>

      <div class="settings-section">
        <h2>Display Options</h2>
        <div class="setting-item">
          <label>
            <input 
              type="checkbox" 
              [(ngModel)]="showCompleted" 
              name="showCompleted"
              (change)="updateShowCompleted()"
            />
            Show completed items
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h2>Data Management</h2>
        <div class="setting-item">
          <button (click)="exportData()" class="action-btn export">
            Export Data
          </button>
          <p class="help-text">Download all your watch list data as a JSON file</p>
        </div>
        <div class="setting-item">
          <button (click)="importData()" class="action-btn import">
            Import Data
          </button>
          <p class="help-text">Replace all data with imported JSON file</p>
        </div>
      </div>

      <div class="settings-section" *ngIf="errorMessage()">
        <div class="error-message">
          {{ errorMessage() }}
        </div>
      </div>

      <div class="settings-section" *ngIf="successMessage()">
        <div class="success-message">
          {{ successMessage() }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 2rem;
      color: light-dark(var(--light-font-color), var(--dark-font-color));
    }

    .settings-section {
      background: light-dark(var(--light-bg-tertiary), var(--dark-bg-tertiary));
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }

    h2 {
      font-size: 1.3rem;
      margin-top: 0;
      margin-bottom: 1rem;
      color: light-dark(var(--light-font-secondary), var(--dark-font-secondary));
    }

    .setting-item {
      margin-bottom: 1rem;
    }

    .setting-item:last-child {
      margin-bottom: 0;
    }

    .setting-item label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .setting-item input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .action-btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 500;
      margin-right: 1rem;
    }

    .action-btn.export {
      background: var(--accent-success);
      color: white;
    }

    .action-btn.export:hover {
      background: var(--accent-success-hover);
    }

    .action-btn.import {
      background: var(--accent-info);
      color: white;
    }

    .action-btn.import:hover {
      background: var(--accent-info-hover);
    }

    .help-text {
      margin: 0.5rem 0 0 0;
      font-size: 0.9rem;
      color: light-dark(var(--light-font-secondary), var(--dark-font-secondary));
    }

    .error-message {
      background: light-dark(#f8d7da, #721c24);
      color: light-dark(#721c24, #f8d7da);
      padding: 1rem;
      border-radius: 4px;
      border: 1px solid light-dark(#f5c6cb, #721c24);
    }

    .success-message {
      background: light-dark(#d4edda, #155724);
      color: light-dark(#155724, #d4edda);
      padding: 1rem;
      border-radius: 4px;
      border: 1px solid light-dark(#c3e6cb, #155724);
    }
  `]
})
export class SettingsComponent implements OnInit {
  showCompleted = false;
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor(
    private storageService: StorageService,
    private importExportService: ImportExportService
  ) {}

  ngOnInit(): void {
    const settings = this.storageService.getSettings();
    this.showCompleted = settings.showCompleted;
  }

  updateShowCompleted(): void {
    this.storageService.updateSettings({ showCompleted: this.showCompleted });
    this.successMessage.set('Settings saved');
    setTimeout(() => this.successMessage.set(null), 3000);
  }

  async exportData(): Promise<void> {
    try {
      await this.importExportService.exportData();
      this.successMessage.set('Data exported successfully');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (error) {
      this.errorMessage.set('Failed to export data');
      setTimeout(() => this.errorMessage.set(null), 5000);
    }
  }

  async importData(): Promise<void> {
    if (!confirm('Importing will replace all existing data. Are you sure?')) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await this.importExportService.importData();
      this.successMessage.set('Data imported successfully');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import data';
      this.errorMessage.set(`Import failed: ${message}`);
      setTimeout(() => this.errorMessage.set(null), 5000);
    }
  }
}

