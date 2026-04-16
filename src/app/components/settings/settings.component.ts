import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImportExportService } from '../../services/import-export.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule],
  template: `
    <div class="max-w-[800px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Settings</h1>

      <div class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg mb-6">
        <h2 class="text-xl mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">Data Management</h2>
        <div class="mb-4 last:mb-0">
          <button (click)="exportData()" class="px-6 py-3 border-none rounded cursor-pointer text-base font-medium mr-4 bg-accent-success text-white hover:bg-accent-success-hover">
            Export Data
          </button>
          <p class="mt-2 mb-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">Download all your watch list data as a JSON file</p>
        </div>
        <div class="mb-4 last:mb-0">
          <label class="flex items-center gap-2 cursor-pointer">
            <input 
              type="file" 
              #fileInput 
              (change)="onFileSelected($event)" 
              accept=".json"
              style="display: none"
            />
            <button (click)="fileInput.click()" class="px-6 py-3 border-none rounded cursor-pointer text-base font-medium mr-4 bg-accent-info text-white hover:bg-accent-info-hover">
              Import Data
            </button>
          </label>
          <p class="mt-2 mb-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">Replace all data with imported JSON file</p>
        </div>
      </div>

      <div class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg mb-6" *ngIf="errorMessage()">
        <div class="bg-error-bg-light dark:bg-error-bg-dark text-error-text-light dark:text-error-text-dark p-4 rounded border border-error-border-light dark:border-error-border-dark">
          {{ errorMessage() }}
        </div>
      </div>

      <div class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg mb-6" *ngIf="successMessage()">
        <div class="bg-success-bg-light dark:bg-success-bg-dark text-success-text-light dark:text-success-text-dark p-4 rounded border border-success-border-light dark:border-success-border-dark">
          {{ successMessage() }}
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent {
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor(
    private importExportService: ImportExportService
  ) {}

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

