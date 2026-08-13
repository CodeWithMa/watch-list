import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

import { ImportExportService } from '../../services/import-export.service';
import { TmdbSettingsService } from '../../services/tmdb-settings.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="max-w-[800px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Settings</h1>

      <div class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg mb-6">
        <h2 class="text-xl mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">
          TMDB
        </h2>
        <div class="mb-4">
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-block"
          >
            <img
              src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg"
              alt="TMDB"
              class="h-12 w-auto"
            />
          </a>
          <p class="mt-3 mb-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </div>
        <div class="mb-4">
          <label for="tmdbToken" class="block mb-2 font-medium text-light-font dark:text-dark-font"
            >API Read Access Token</label
          >
          <input
            id="tmdbToken"
            type="password"
            [ngModel]="tmdbToken()"
            (ngModelChange)="tmdbToken.set($event)"
            autocomplete="off"
            class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
          />
          <p class="mt-2 mb-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
            Preferred for fetching movie and series suggestions while adding items.
          </p>
        </div>
        <div class="mb-4">
          <label for="tmdbApiKey" class="block mb-2 font-medium text-light-font dark:text-dark-font"
            >API Key</label
          >
          <input
            id="tmdbApiKey"
            type="password"
            [ngModel]="tmdbApiKey()"
            (ngModelChange)="tmdbApiKey.set($event)"
            autocomplete="off"
            class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
          />
          <p class="mt-2 mb-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
            Used as a fallback when no read access token is saved.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button
            (click)="saveTmdbToken()"
            class="px-6 py-3 border-none rounded cursor-pointer text-base font-medium bg-accent-primary text-white hover:bg-accent-primary-hover"
          >
            Save Credentials
          </button>
          <button
            (click)="clearTmdbToken()"
            class="px-6 py-3 border-none rounded cursor-pointer text-base font-medium bg-accent-secondary text-white hover:bg-accent-secondary-hover"
          >
            Clear Credentials
          </button>
        </div>
        @if (tmdbSettingsMessage()) {
          <div class="mt-4 text-sm text-accent-secondary">{{ tmdbSettingsMessage() }}</div>
        }
      </div>

      <div class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg mb-6">
        <h2 class="text-xl mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">
          Data Management
        </h2>
        <div class="mb-4 last:mb-0">
          <button
            (click)="exportData()"
            class="px-6 py-3 border-none rounded cursor-pointer text-base font-medium mr-4 bg-accent-success text-white hover:bg-accent-success-hover"
          >
            Export Data
          </button>
          <p class="mt-2 mb-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
            Download your watch list and locally stored poster images as a JSON file
          </p>
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
            <button
              (click)="fileInput.click()"
              class="px-6 py-3 border-none rounded cursor-pointer text-base font-medium mr-4 bg-accent-info text-white hover:bg-accent-info-hover"
            >
              Import Data
            </button>
          </label>
          <p class="mt-2 mb-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
            Replace all data with imported JSON file
          </p>
        </div>
      </div>

      @if (errorMessage()) {
        <div class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg mb-6">
          <div
            class="bg-error-bg-light dark:bg-error-bg-dark text-error-text-light dark:text-error-text-dark p-4 rounded border border-error-border-light dark:border-error-border-dark"
          >
            {{ errorMessage() }}
          </div>
        </div>
      }

      @if (successMessage()) {
        <div class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg mb-6">
          <div
            class="bg-success-bg-light dark:bg-success-bg-dark text-success-text-light dark:text-success-text-dark p-4 rounded border border-success-border-light dark:border-success-border-dark"
          >
            {{ successMessage() }}
          </div>
        </div>
      }

      @if (recoveryBackups().length > 0) {
        <div class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg mb-6">
          <h2 class="text-xl mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">
            Recovery Backups
          </h2>
          @for (backup of recoveryBackups(); track backup.key) {
            <div
              class="flex items-center justify-between mb-3 last:mb-0 p-3 rounded bg-light-bg-secondary dark:bg-dark-bg-secondary"
            >
              <div>
                <div class="text-sm text-light-font dark:text-dark-font">
                  {{ backup.timestamp | date: 'medium' }}
                </div>
              </div>
              <button
                (click)="exportRecoveryBackup(backup.key)"
                class="px-4 py-2 border-none rounded cursor-pointer text-sm font-medium bg-accent-secondary text-white hover:bg-accent-secondary-hover"
              >
                Download
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  private importExportService = inject(ImportExportService);
  private tmdbSettingsService = inject(TmdbSettingsService);

  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  tmdbToken = signal(this.tmdbSettingsService.token());
  tmdbApiKey = signal(this.tmdbSettingsService.key());
  tmdbSettingsMessage = signal<string | null>(null);
  recoveryBackups = signal<{ key: string; timestamp: Date }[]>([]);

  ngOnInit(): void {
    this.loadRecoveryBackups();
  }

  saveTmdbToken(): void {
    this.tmdbSettingsService.saveCredentials(this.tmdbToken(), this.tmdbApiKey());
    this.tmdbToken.set(this.tmdbSettingsService.token());
    this.tmdbApiKey.set(this.tmdbSettingsService.key());
    this.tmdbSettingsMessage.set(this.getTmdbSettingsMessage());
  }

  clearTmdbToken(): void {
    this.tmdbSettingsService.clearCredentials();
    this.tmdbToken.set('');
    this.tmdbApiKey.set('');
    this.tmdbSettingsMessage.set('TMDB credentials cleared.');
  }

  private getTmdbSettingsMessage(): string {
    const credential = this.tmdbSettingsService.getCredential();
    if (!credential) {
      return 'TMDB credentials cleared.';
    }

    return credential.type === 'read-token'
      ? 'TMDB read access token saved and will be used first.'
      : 'TMDB API key saved and will be used as fallback.';
  }

  async exportData(): Promise<void> {
    try {
      await this.importExportService.exportData();
      this.successMessage.set('Data exported successfully');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch {
      this.errorMessage.set('Failed to export data');
      setTimeout(() => this.errorMessage.set(null), 5000);
    }
  }

  async exportRecoveryBackup(key: string): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await this.importExportService.exportRecoveryBackup(key);
      this.successMessage.set('Recovery backup exported successfully');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export recovery backup';
      this.errorMessage.set(message);
      setTimeout(() => this.errorMessage.set(null), 5000);
    }
  }

  private async loadRecoveryBackups(): Promise<void> {
    try {
      const backups = await this.importExportService.getRecoveryBackups();
      this.recoveryBackups.set(backups);
    } catch {
      this.recoveryBackups.set([]);
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
