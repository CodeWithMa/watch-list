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
          <label>
            <input 
              type="file" 
              #fileInput 
              (change)="onFileSelected($event)" 
              accept=".json"
              style="display: none"
            />
            <button (click)="fileInput.click()" class="action-btn import">
              Import Data
            </button>
          </label>
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
      color: #333;
    }

    .settings-section {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }

    h2 {
      font-size: 1.3rem;
      margin-top: 0;
      margin-bottom: 1rem;
      color: #555;
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
      background: #28a745;
      color: white;
    }

    .action-btn.export:hover {
      background: #218838;
    }

    .action-btn.import {
      background: #17a2b8;
      color: white;
    }

    .action-btn.import:hover {
      background: #138496;
    }

    .help-text {
      margin: 0.5rem 0 0 0;
      font-size: 0.9rem;
      color: #666;
    }

    .error-message {
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      border: 1px solid #f5c6cb;
    }

    .success-message {
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      border: 1px solid #c3e6cb;
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

  exportData(): void {
    try {
      this.importExportService.exportData();
      this.successMessage.set('Data exported successfully');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (error) {
      this.errorMessage.set('Failed to export data');
      setTimeout(() => this.errorMessage.set(null), 5000);
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) {
      return;
    }

    if (!confirm('Importing will replace all existing data. Are you sure?')) {
      input.value = '';
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await this.importExportService.importData(file);
      this.successMessage.set('Data imported successfully');
      setTimeout(() => this.successMessage.set(null), 3000);
      input.value = '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import data';
      this.errorMessage.set(`Import failed: ${message}`);
      setTimeout(() => this.errorMessage.set(null), 5000);
      input.value = '';
    }
  }
}

