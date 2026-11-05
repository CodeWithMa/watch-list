import { Component, computed, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

import { ImportExportService, ImportReport } from '../../services/import-export.service';
import { FilePickerFocusDirective } from '../../directives/file-picker-focus.directive';
import { UnsupportedSchemaVersionError } from '../../domain/storage-schema';
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
import { CollectionConflictError, StorageService } from '../../services/storage.service';
import { ConflictRecoveryComponent } from '../conflict-recovery/conflict-recovery.component';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, DatePipe, FilePickerFocusDirective, ConflictRecoveryComponent],
  template: `
    <div>
      <h1 class="page-title mb-6">Settings</h1>

      <p class="mt-0 mb-4 text-sm text-light-font-secondary dark:text-dark-font-secondary">
        Preferences save automatically. TMDB credentials save when you choose Save Credentials.
      </p>

      <section class="card p-4 sm:p-6 mb-4">
        <h2 class="section-title mb-2">Title &amp; poster search</h2>
        <p class="mt-0 mb-3 text-sm text-light-font-secondary dark:text-dark-font-secondary">
          Choose which sources suggest titles and posters. Disabled providers are not queried.
          Adding titles manually never needs a provider.
        </p>
        <div class="flex flex-col gap-3 mb-4">
          <label class="choice-row">
            <input
              id="providerToggleTmdb"
              type="checkbox"
              [checked]="tmdbEnabled()"
              (change)="toggleProvider('tmdb', $event)"
            />
            <span>
              <span class="flex flex-wrap items-center gap-x-2">
                TMDB
                <span
                  class="text-xs font-medium rounded px-1.5 py-0.5"
                  [class]="
                    tmdbConnected()
                      ? 'bg-status-completed-bg-light dark:bg-status-completed-bg-dark text-status-completed-text-light dark:text-status-completed-text-dark'
                      : 'bg-status-not-started-bg-light dark:bg-status-not-started-bg-dark text-status-not-started-text-light dark:text-status-not-started-text-dark'
                  "
                  >{{ tmdbConnected() ? 'Connected' : 'Needs setup' }}</span
                >
              </span>
              <span class="choice-hint">Movies &amp; series</span>
            </span>
          </label>
          <label class="choice-row">
            <input
              id="providerToggleJikan"
              type="checkbox"
              [checked]="jikanEnabled()"
              (change)="toggleProvider('jikan', $event)"
            />
            <span>
              Jikan (MyAnimeList)
              <span class="choice-hint">TV, movies, OVA &amp; ONA</span>
            </span>
          </label>
          <label class="choice-row">
            <input
              id="providerToggleAnilist"
              type="checkbox"
              [checked]="anilistEnabled()"
              (change)="toggleProvider('anilist', $event)"
            />
            <span>
              AniList
              <span class="choice-hint">Anime</span>
            </span>
          </label>
        </div>

        <details class="form-section" [open]="!tmdbConnected()">
          <summary>TMDB connection</summary>
          <div>
            <div class="flex items-center gap-3 mb-4">
              <a
                href="https://www.themoviedb.org"
                target="_blank"
                rel="noopener noreferrer"
                class="shrink-0"
              >
                <img
                  src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg"
                  alt="TMDB"
                  class="h-10 w-auto"
                />
              </a>
              <p class="m-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
                This product uses the TMDB API but is not endorsed or certified by TMDB.
              </p>
            </div>
            <div class="mb-4">
              <label
                for="tmdbToken"
                class="block mb-2 font-medium text-light-font dark:text-dark-font"
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
              <label
                for="tmdbApiKey"
                class="block mb-2 font-medium text-light-font dark:text-dark-font"
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
            <div class="flex flex-wrap gap-2">
              <button type="button" (click)="saveTmdbToken()" class="btn btn-primary">
                Save Credentials
              </button>
              <button type="button" (click)="clearTmdbToken()" class="btn btn-secondary">
                Clear Credentials
              </button>
            </div>
          </div>
        </details>
        @if (tmdbSettingsMessage()) {
          <div
            role="status"
            class="mb-4 text-sm text-light-font-secondary dark:text-dark-font-secondary"
          >
            {{ tmdbSettingsMessage() }}
          </div>
        }

        <p class="m-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
          <a
            href="https://anilist.co"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-text hover:underline font-medium"
            >AniList</a
          >
          &amp;
          <a
            href="https://jikan.moe"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-text hover:underline font-medium"
            >Jikan</a
          >
          (<a
            href="https://myanimelist.net"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-text hover:underline"
            >MyAnimeList</a
          >) are public APIs and need no setup. SFW by default ·
          <a
            href="https://anilist.gitbook.io/anilist-apiv2-docs/docs/guide/rate-limiting"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-text hover:underline"
            >AniList limits</a
          >
          ·
          <a
            href="https://docs.api.jikan.moe/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-text hover:underline"
            >Jikan docs</a
          >
          (3 req/s). Not endorsed by AniList or MyAnimeList / Jikan.
        </p>
      </section>

      <section class="card p-4 sm:p-6 mb-4">
        <h2 class="section-title mb-3">Adult content</h2>
        <label class="choice-row">
          <input
            id="includeAdultToggle"
            type="checkbox"
            [checked]="includeAdult()"
            (change)="toggleAdult($event)"
          />
          <span>Include adult / NSFW results (TMDB, Jikan, AniList)</span>
        </label>

        <fieldset class="mt-4">
          <legend class="text-sm font-medium text-light-font dark:text-dark-font mb-2">
            Display adult items in your collection
          </legend>
          <div class="flex flex-col md:gap-2">
            <label class="choice-row">
              <input
                type="radio"
                name="adultDisplayMode"
                value="show"
                [checked]="adultDisplayMode() === 'show'"
                (change)="setAdultDisplayMode('show')"
              />
              <span>Show — no filtering or blur</span>
            </label>
            <label class="choice-row">
              <input
                type="radio"
                name="adultDisplayMode"
                value="blur"
                [checked]="adultDisplayMode() === 'blur'"
                (change)="setAdultDisplayMode('blur')"
              />
              <span>Blur posters — click to reveal</span>
            </label>
            <label class="choice-row">
              <input
                type="radio"
                name="adultDisplayMode"
                value="hide"
                [checked]="adultDisplayMode() === 'hide'"
                (change)="setAdultDisplayMode('hide')"
              />
              <span>Hide — remove adult items from lists</span>
            </label>
          </div>
        </fieldset>
      </section>

      <section class="card p-4 sm:p-6 mb-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-title">Anime title language order</h2>
          <button
            type="button"
            (click)="resetTitlePreference()"
            class="btn btn-quiet"
            aria-label="Reset title language order to default"
          >
            Reset
          </button>
        </div>
        <p class="text-sm mt-0 mb-3 text-light-font-secondary dark:text-dark-font-secondary">
          Top is tried first. Reorder with up/down. Applies to AniList &amp; Jikan suggestions.
        </p>
        <ol class="flex flex-col gap-2" aria-label="Title language preference order">
          @for (lang of titleOrder(); track lang; let i = $index) {
            <li class="flex items-center justify-between py-1">
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
                  class="btn btn-secondary !px-3"
                  [attr.aria-label]="'Move ' + titleLanguageLabel(lang) + ' up'"
                >
                  ↑
                </button>
                <button
                  type="button"
                  (click)="moveTitleDown(i)"
                  [disabled]="i === titleOrder().length - 1"
                  class="btn btn-secondary !px-3"
                  [attr.aria-label]="'Move ' + titleLanguageLabel(lang) + ' down'"
                >
                  ↓
                </button>
              </div>
            </li>
          }
        </ol>
      </section>

      <section class="card p-4 sm:p-6 mb-4">
        <h2 class="section-title mb-3">Backup &amp; restore</h2>
        <app-conflict-recovery
          [disabled]="importInProgress()"
          (recovered)="errorMessage.set(null)"
        />
        <div class="mb-4 last:mb-0">
          <button (click)="exportData()" class="btn btn-secondary">Export Data</button>
          <p class="mt-2 mb-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
            Download your current watch list and available poster images as a JSON file. Unavailable
            posters are listed in the export; metadata can be recovered even without images.
          </p>
        </div>
        <div class="mb-4 last:mb-0">
          <div>
            <button
              type="button"
              (click)="fileInput.click()"
              [disabled]="importInProgress()"
              class="btn btn-secondary"
            >
              Import Data
            </button>
            <input
              type="file"
              appFilePickerFocus
              #fileInput
              (change)="onFileSelected($event)"
              accept=".json"
              class="hidden"
              aria-label="Choose JSON file to import"
            />
          </div>
          <p class="mt-2 mb-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
            Replaces your current collection with an imported JSON file. You confirm before anything
            changes.
          </p>
          @if (pendingImportFile()) {
            <div role="alert" class="mt-4 p-4 rounded border border-accent-danger-text">
              <p class="mt-0 mb-3 text-sm text-light-font dark:text-dark-font">
                Import "{{ pendingImportFile()?.name }}"? This will replace all existing data.
              </p>
              <div class="flex flex-wrap gap-3">
                <button
                  (click)="confirmImport()"
                  [disabled]="importInProgress() || refreshing()"
                  class="btn btn-danger"
                >
                  Confirm Import
                </button>
                <button
                  (click)="cancelImport()"
                  [disabled]="importInProgress()"
                  class="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          }
        </div>
        @if (errorMessage()) {
          <div
            role="alert"
            class="mt-4 bg-error-bg-light dark:bg-error-bg-dark text-error-text-light dark:text-error-text-dark p-4 rounded border border-error-border-light dark:border-error-border-dark"
          >
            {{ errorMessage() }}
          </div>
        }

        @if (successMessage()) {
          <div
            role="status"
            class="mt-4 bg-success-bg-light dark:bg-success-bg-dark text-success-text-light dark:text-success-text-dark p-4 rounded border border-success-border-light dark:border-success-border-dark"
          >
            {{ successMessage() }}
          </div>
        }
      </section>

      @if (recoveryBackups().length > 0) {
        <section class="card p-4 sm:p-6 mb-4">
          <h2 class="section-title mb-3">Recovery Backups</h2>
          @for (backup of recoveryBackups(); track backup.key) {
            <div class="flex items-center justify-between gap-3 mb-2 last:mb-0">
              <div>
                <div class="text-sm text-light-font dark:text-dark-font">
                  {{ backup.timestamp | date: 'medium' }}
                </div>
              </div>
              <button (click)="exportRecoveryBackup(backup.key)" class="btn btn-secondary">
                Download
              </button>
            </div>
          }
        </section>
      }

      <section class="card p-4 sm:p-6">
        <h2 class="section-title mb-3">About</h2>
        <p class="m-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
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
      </section>
    </div>
  `,
})
export class SettingsComponent implements OnInit, OnDestroy {
  readonly refreshing = inject(StorageService).getRefreshingSignal();
  private importExportService = inject(ImportExportService);
  private tmdbSettingsService = inject(TmdbSettingsService);
  private providerSettingsService = inject(ProviderSettingsService);
  private errorTimeout: ReturnType<typeof setTimeout> | undefined;

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
  tmdbConnected = computed(() => !!this.tmdbSettingsService.getCredential());
  tmdbEnabled = signal(this.providerSettingsService.isEnabled('tmdb'));
  jikanEnabled = signal(this.providerSettingsService.isEnabled('jikan'));
  anilistEnabled = signal(this.providerSettingsService.isEnabled('anilist'));
  includeAdult = signal(this.providerSettingsService.isAdultIncluded());
  adultDisplayMode = signal<AdultDisplayMode>(this.providerSettingsService.getAdultDisplayMode());
  titleOrder = signal<TitlePreference>(this.providerSettingsService.getTitlePreference());
  recoveryBackups = signal<{ key: string; timestamp: Date }[]>([]);
  pendingImportFile = signal<File | null>(null);
  importInProgress = signal(false);

  ngOnInit(): void {
    this.loadRecoveryBackups();
  }

  ngOnDestroy() {
    clearTimeout(this.errorTimeout);
  }

  saveTmdbToken(): void {
    const saved = this.tmdbSettingsService.saveCredentials(this.tmdbToken(), this.tmdbApiKey());
    this.tmdbToken.set(this.tmdbSettingsService.token());
    this.tmdbApiKey.set(this.tmdbSettingsService.key());
    this.tmdbSettingsMessage.set(
      saved
        ? this.getTmdbSettingsMessage()
        : 'TMDB credentials apply to this session but could not be saved completely. Retry saving when browser storage is available.',
    );
  }

  clearTmdbToken(): void {
    const cleared = this.tmdbSettingsService.clearCredentials();
    this.tmdbToken.set('');
    this.tmdbApiKey.set('');
    this.tmdbSettingsMessage.set(
      cleared
        ? 'TMDB credentials cleared.'
        : 'TMDB credentials cleared for this session only. Stored credentials could not all be removed and may return on reload. Retry clearing when browser storage is available.',
    );
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
    this.setError(null);
    this.successMessage.set(null);
    try {
      const posters = await this.importExportService.exportData();
      if (posters.unavailable || posters.omittedIds.length) {
        this.successMessage.set(
          `Metadata exported with ${posters.included} poster image(s) included; ${posters.omittedIds.length} unavailable poster(s) omitted. This is not a complete poster backup.${posters.unavailable ? ' Poster storage could not be read.' : ''}`,
        );
        return;
      }
      this.successMessage.set('Data exported successfully');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch {
      this.setError('Failed to export data');
    }
  }

  async exportRecoveryBackup(key: string): Promise<void> {
    this.setError(null);
    this.successMessage.set(null);

    try {
      await this.importExportService.exportRecoveryBackup(key);
      this.successMessage.set('Recovery backup exported successfully');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export recovery backup';
      this.setError(message);
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

    this.setError(null);
    this.successMessage.set(null);
    this.pendingImportFile.set(file);
    input.value = '';
  }

  cancelImport(): void {
    this.pendingImportFile.set(null);
  }

  async confirmImport(): Promise<void> {
    const file = this.pendingImportFile();
    if (!file || this.importInProgress() || this.refreshing()) {
      return;
    }

    this.setError(null);
    this.successMessage.set(null);
    this.importInProgress.set(true);
    let retainFile = false;

    try {
      const report = await this.importExportService.importData(file);
      this.syncProviderSignals();
      this.successMessage.set(describeImportResult(report));
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import data';
      const importError = `Import failed: ${message}`;
      retainFile = error instanceof CollectionConflictError;
      this.setError(importError, retainFile || error instanceof UnsupportedSchemaVersionError);
    } finally {
      // A file staged while this import ran belongs to the next confirmation;
      // only clear the pending state when it is still this call's file.
      if (!retainFile && this.pendingImportFile() === file) {
        this.pendingImportFile.set(null);
      }
      this.importInProgress.set(false);
    }
  }

  private setError(message: string | null, persistent = false) {
    clearTimeout(this.errorTimeout);
    this.errorTimeout = undefined;
    this.errorMessage.set(message);
    if (message && !persistent) {
      this.errorTimeout = setTimeout(() => this.errorMessage.set(null), 5000);
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

function describeImportResult({
  dropped,
  repairedGroupReferences,
  durability,
  posters,
  posterCleanupSkipped,
}: ImportReport): string {
  const session =
    (posters
      ? ` ${posters.included} poster image(s) included; ${posters.omittedIds.length} unavailable poster(s) omitted.`
      : '') +
    (durability === 'session-only'
      ? ' Data is kept only in this session and will be lost on reload.'
      : '') +
    (posterCleanupSkipped
      ? ' Poster cleanup was unavailable; unreferenced local files may remain and are excluded from exports.'
      : '');
  const total = dropped.groups + dropped.items + dropped.deletedItems;
  if (total === 0 && repairedGroupReferences === 0) {
    return `Data imported successfully${session}`;
  }
  const details = [];
  if (total > 0) details.push(`${total} invalid record(s) omitted`);
  if (repairedGroupReferences > 0) {
    details.push(`${repairedGroupReferences} missing group reference(s) repaired to Ungrouped`);
  }
  return `Import completed with ${details.join(' and ')}.${session}`;
}
