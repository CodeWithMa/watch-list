import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

import { ImportExportService } from '../../services/import-export.service';
import {
  AdultDisplayMode,
  DEFAULT_TITLE_PREFERENCE,
  ProviderSettingsService,
  TitleLanguage,
  TitlePreference,
} from '../../services/provider-settings.service';
import { TmdbSettingsService } from '../../services/tmdb-settings.service';
import { SuggestionSource } from '../../models/suggestion.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, DatePipe],
  template: `
    <div>
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
            class="form-control"
          />
          <p class="mt-2 mb-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
            Preferred for movie &amp; series suggestions.
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
            class="form-control"
          />
          <p class="mt-2 mb-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
            Fallback if no token is set.
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
          Suggestion Providers
        </h2>
        <p class="text-sm text-light-font-secondary dark:text-dark-font-secondary">
          Choose which sources are used for title and poster suggestions. Disabled providers are not
          queried.
        </p>
        <div class="mt-4 flex flex-col gap-3">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              id="providerToggleTmdb"
              type="checkbox"
              [checked]="tmdbEnabled()"
              (change)="toggleProvider('tmdb', $event)"
              class="w-5 h-5"
            />
            <span class="text-light-font dark:text-dark-font">TMDB — Movies &amp; Series</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              id="providerToggleJikan"
              type="checkbox"
              [checked]="jikanEnabled()"
              (change)="toggleProvider('jikan', $event)"
              class="w-5 h-5"
            />
            <span class="text-light-font dark:text-dark-font"
              >Jikan (MyAnimeList) — TV / Movie / OVA / ONA</span
            >
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              id="providerToggleAnilist"
              type="checkbox"
              [checked]="anilistEnabled()"
              (change)="toggleProvider('anilist', $event)"
              class="w-5 h-5"
            />
            <span class="text-light-font dark:text-dark-font">AniList — Anime</span>
          </label>
        </div>

        <div class="mt-6 pt-6 border-t border-light-border dark:border-dark-border">
          <h3 class="text-base font-medium mb-3 text-light-font dark:text-dark-font">
            Adult content
          </h3>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              id="includeAdultToggle"
              type="checkbox"
              [checked]="includeAdult()"
              (change)="toggleAdult($event)"
              class="w-5 h-5"
            />
            <span class="text-light-font dark:text-dark-font"
              >Include adult / NSFW results (TMDB, Jikan, AniList)</span
            >
          </label>

          <fieldset class="mt-4">
            <legend class="text-sm font-medium text-light-font dark:text-dark-font mb-2">
              Display adult items in your collection
            </legend>
            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="adultDisplayMode"
                  value="show"
                  [checked]="adultDisplayMode() === 'show'"
                  (change)="setAdultDisplayMode('show')"
                  class="w-4 h-4"
                />
                <span class="text-sm text-light-font dark:text-dark-font"
                  >Show — no filtering or blur</span
                >
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="adultDisplayMode"
                  value="blur"
                  [checked]="adultDisplayMode() === 'blur'"
                  (change)="setAdultDisplayMode('blur')"
                  class="w-4 h-4"
                />
                <span class="text-sm text-light-font dark:text-dark-font"
                  >Blur posters — click to reveal</span
                >
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="adultDisplayMode"
                  value="hide"
                  [checked]="adultDisplayMode() === 'hide'"
                  (change)="setAdultDisplayMode('hide')"
                  class="w-4 h-4"
                />
                <span class="text-sm text-light-font dark:text-dark-font"
                  >Hide — remove adult items from lists</span
                >
              </label>
            </div>
          </fieldset>
        </div>

        <div class="mt-6 pt-6 border-t border-light-border dark:border-dark-border">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-base font-medium text-light-font dark:text-dark-font">
              Anime title language order
            </h3>
            <button
              type="button"
              (click)="resetTitlePreference()"
              class="text-xs text-accent-primary hover:underline bg-transparent border-none cursor-pointer p-0"
              aria-label="Reset title language order to default"
            >
              Reset
            </button>
          </div>
          <p class="text-xs mb-3 text-light-font-secondary dark:text-dark-font-secondary">
            Top is tried first. Reorder with up/down. Applies to AniList &amp; Jikan suggestions.
          </p>
          <ol class="flex flex-col gap-2" aria-label="Title language preference order">
            @for (lang of titleOrder(); track lang; let i = $index) {
              <li
                class="flex items-center justify-between p-3 rounded bg-light-bg-secondary dark:bg-dark-bg-secondary"
              >
                <div class="flex items-center gap-3">
                  <span
                    class="text-sm font-medium text-light-font-secondary dark:text-dark-font-secondary w-6"
                    >{{ i + 1 }}.</span
                  >
                  <span class="text-sm text-light-font dark:text-dark-font">{{
                    titleLanguageLabel(lang)
                  }}</span>
                  <span class="text-xs text-light-font-secondary dark:text-dark-font-secondary"
                    >({{ lang }})</span
                  >
                </div>
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    (click)="moveTitleUp(i)"
                    [disabled]="i === 0"
                    class="px-2 py-1 text-xs rounded border border-light-border dark:border-dark-border bg-light-bg-tertiary dark:bg-dark-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-light-bg-secondary dark:hover:bg-dark-bg-secondary"
                    [attr.aria-label]="'Move ' + titleLanguageLabel(lang) + ' up'"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    (click)="moveTitleDown(i)"
                    [disabled]="i === titleOrder().length - 1"
                    class="px-2 py-1 text-xs rounded border border-light-border dark:border-dark-border bg-light-bg-tertiary dark:bg-dark-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-light-bg-secondary dark:hover:bg-dark-bg-secondary"
                    [attr.aria-label]="'Move ' + titleLanguageLabel(lang) + ' down'"
                  >
                    ↓
                  </button>
                </div>
              </li>
            }
          </ol>
        </div>
      </div>

      <div class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg mb-6">
        <h2 class="text-xl mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">
          Anime Suggestions
        </h2>
        <p class="text-sm text-light-font-secondary dark:text-dark-font-secondary">
          <a
            href="https://anilist.co"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-primary hover:underline font-medium"
            >AniList</a
          >
          &amp;
          <a
            href="https://jikan.moe"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-primary hover:underline font-medium"
            >Jikan</a
          >
          (<a
            href="https://myanimelist.net"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-primary hover:underline"
            >MyAnimeList</a
          >) — public APIs, no setup required.
        </p>
        <p class="mt-2 text-sm text-light-font-secondary dark:text-dark-font-secondary">
          TV / Movie / OVA / ONA · SFW by default (toggle in Suggestion Providers) ·
          <a
            href="https://anilist.gitbook.io/anilist-apiv2-docs/docs/guide/rate-limiting"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-primary hover:underline"
            >AniList limits</a
          >
          ·
          <a
            href="https://docs.api.jikan.moe/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-primary hover:underline"
            >Jikan docs</a
          >
          (3 req/s)
        </p>
        <p class="mt-2 text-xs text-light-font-secondary dark:text-dark-font-secondary">
          Not endorsed by AniList or MyAnimeList / Jikan.
        </p>
      </div>

      <div class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg mb-6">
        <h2 class="text-xl mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">
          Data Management
        </h2>
        <div class="mb-4">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              id="includePreferencesToggle"
              type="checkbox"
              [checked]="includePreferences()"
              (change)="includePreferences.set($any($event.target).checked)"
              class="w-5 h-5"
            />
            <span class="text-sm text-light-font dark:text-dark-font"
              >Include preferences (providers, adult filter &amp; display, title order)</span
            >
          </label>
          <p class="mt-1 mb-0 text-xs text-light-font-secondary dark:text-dark-font-secondary">
            TMDB tokens are never included.
          </p>
        </div>
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

      <div class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg">
        <h2 class="text-xl mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">
          About
        </h2>
        <p class="text-sm text-light-font-secondary dark:text-dark-font-secondary">
          Watch List v{{ environment.appVersion }}
          @if (isHashLinkable) {
            (<a
              [href]="'https://github.com/CodeWithMa/watch-list/commit/' + environment.commitHash"
              target="_blank"
              rel="noopener noreferrer"
              class="underline hover:no-underline"
              >{{ shortHash }}</a
            >)
          } @else {
            ({{ shortHash }})
          }
          — Built
          @if (environment.buildDate !== 'unknown') {
            {{ environment.buildDate | date: 'medium' }}
          } @else {
            unknown
          }
        </p>
      </div>
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  private importExportService = inject(ImportExportService);
  private tmdbSettingsService = inject(TmdbSettingsService);
  private providerSettingsService = inject(ProviderSettingsService);

  protected readonly environment = environment;

  get shortHash(): string {
    return environment.commitHash?.substring(0, 7) ?? 'unknown';
  }

  get isHashLinkable(): boolean {
    return !!environment.commitHash && environment.commitHash !== 'unknown';
  }

  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  tmdbToken = signal(this.tmdbSettingsService.token());
  tmdbApiKey = signal(this.tmdbSettingsService.key());
  tmdbSettingsMessage = signal<string | null>(null);
  tmdbEnabled = signal(this.providerSettingsService.isEnabled('tmdb'));
  jikanEnabled = signal(this.providerSettingsService.isEnabled('jikan'));
  anilistEnabled = signal(this.providerSettingsService.isEnabled('anilist'));
  includeAdult = signal(this.providerSettingsService.isAdultIncluded());
  adultDisplayMode = signal<AdultDisplayMode>(this.providerSettingsService.getAdultDisplayMode());
  titleOrder = signal<TitlePreference>(this.providerSettingsService.getTitlePreference());
  includePreferences = signal(true);
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

  toggleProvider(source: SuggestionSource, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.providerSettingsService.setEnabled(source, checked);
    this.tmdbEnabled.set(this.providerSettingsService.isEnabled('tmdb'));
    this.jikanEnabled.set(this.providerSettingsService.isEnabled('jikan'));
    this.anilistEnabled.set(this.providerSettingsService.isEnabled('anilist'));
  }

  toggleAdult(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.providerSettingsService.setIncludeAdult(checked);
    this.includeAdult.set(this.providerSettingsService.isAdultIncluded());
  }

  setAdultDisplayMode(mode: AdultDisplayMode): void {
    this.providerSettingsService.setAdultDisplayMode(mode);
    this.adultDisplayMode.set(this.providerSettingsService.getAdultDisplayMode());
  }

  titleLanguageLabel(lang: TitleLanguage): string {
    switch (lang) {
      case 'romaji':
        return 'Romaji';
      case 'english':
        return 'English';
      case 'native':
        return 'Native';
      default:
        return lang;
    }
  }

  moveTitleUp(index: number): void {
    if (index <= 0) return;
    this.swapTitleOrder(index, index - 1);
  }

  moveTitleDown(index: number): void {
    if (index >= this.titleOrder().length - 1) return;
    this.swapTitleOrder(index, index + 1);
  }

  resetTitlePreference(): void {
    this.providerSettingsService.setTitlePreference([...DEFAULT_TITLE_PREFERENCE]);
    this.titleOrder.set(this.providerSettingsService.getTitlePreference());
  }

  private swapTitleOrder(i: number, j: number): void {
    const next: TitlePreference = [...this.titleOrder()];
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    this.providerSettingsService.setTitlePreference(next);
    this.titleOrder.set(this.providerSettingsService.getTitlePreference());
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
      await this.importExportService.exportData({
        includePreferences: this.includePreferences(),
      });
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
      this.syncProviderSignals();
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

  private syncProviderSignals(): void {
    this.tmdbEnabled.set(this.providerSettingsService.isEnabled('tmdb'));
    this.jikanEnabled.set(this.providerSettingsService.isEnabled('jikan'));
    this.anilistEnabled.set(this.providerSettingsService.isEnabled('anilist'));
    this.includeAdult.set(this.providerSettingsService.isAdultIncluded());
    this.adultDisplayMode.set(this.providerSettingsService.getAdultDisplayMode());
    this.titleOrder.set(this.providerSettingsService.getTitlePreference());
  }
}
