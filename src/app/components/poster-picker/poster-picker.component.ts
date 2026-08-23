import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TmdbSuggestion } from '../../models/tmdb-suggestion.model';
import { TmdbSuggestionService } from '../../services/tmdb-suggestion.service';
import { ImageStorageService } from '../../services/image-storage.service';
import { getPosterUrl, getPlaceholderUrl } from '../../utils/tmdb-image.utils';
import { createTmdbSearchStream } from '../../utils/tmdb-search.utils';

@Component({
  selector: 'app-poster-picker',
  imports: [FormsModule],
  template: `
    <div class="flex gap-4">
      <div class="shrink-0">
        @if (posterPreviewUrl()) {
          <img
            [src]="posterPreviewUrl()"
            alt="Poster preview"
            class="w-32 aspect-[2/3] object-cover rounded border border-light-border dark:border-dark-border"
          />
        } @else {
          <img
            [src]="posterPlaceholderUrl()"
            alt="No poster"
            class="w-32 aspect-[2/3] object-cover rounded border border-light-border dark:border-dark-border"
          />
        }
      </div>
      <div class="flex-1 flex flex-col gap-3 min-w-0">
        @if (showPosterSearch()) {
          <div>
            <input
              type="text"
              [ngModel]="posterSearchQuery()"
              (ngModelChange)="onPosterSearchChanged($event)"
              name="posterSearch"
              placeholder="Search TMDB for a poster..."
              class="form-control-sm"
            />
            @if (posterSuggestionsLoading()) {
              <div class="mt-1 text-xs text-light-font-secondary dark:text-dark-font-secondary">
                Searching...
              </div>
            } @else if (posterSuggestionsError()) {
              <div class="mt-1 text-xs text-accent-secondary">{{ posterSuggestionsError() }}</div>
            } @else if (posterSuggestions().length > 0) {
              <div
                class="mt-1 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary max-h-48 overflow-y-auto"
              >
                @for (
                  suggestion of posterSuggestions();
                  track suggestion.type + '-' + suggestion.tmdbId
                ) {
                  <button
                    type="button"
                    (click)="selectPosterFromTmdb(suggestion)"
                    class="w-full text-left px-2 py-1.5 border-0 border-b border-light-border dark:border-dark-border last:border-b-0 bg-transparent hover:bg-light-hover dark:hover:bg-dark-hover cursor-pointer flex items-center gap-2"
                  >
                    @if (suggestion.posterPath) {
                      <img
                        [src]="getPosterThumbUrl(suggestion.posterPath)"
                        alt=""
                        class="w-8 aspect-[2/3] object-cover rounded shrink-0"
                      />
                    }
                    <span class="text-xs text-light-font dark:text-dark-font truncate">
                      {{ suggestion.title }}
                      @if (suggestion.year) {
                        <span class="text-light-font-muted dark:text-dark-font-muted"
                          >({{ suggestion.year }})</span
                        >
                      }
                    </span>
                  </button>
                }
              </div>
            }
          </div>
        }
        @if (posterId()) {
          <button
            type="button"
            (click)="clearPoster()"
            class="self-start px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer hover:bg-light-hover dark:hover:bg-dark-hover text-sm"
          >
            Clear poster
          </button>
        }
        <label
          class="self-start px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer hover:bg-light-hover dark:hover:bg-dark-hover text-sm"
        >
          Upload image
          <input type="file" accept="image/*" class="hidden" (change)="uploadPoster($event)" />
        </label>
        @if (posterLoading()) {
          <div class="text-xs text-light-font-secondary dark:text-dark-font-secondary">
            Saving poster...
          </div>
        }
        @if (posterError()) {
          <div class="text-xs text-accent-danger">{{ posterError() }}</div>
        }
        @if (!showPosterSearch()) {
          <button
            type="button"
            (click)="showPosterSearch.set(true)"
            class="self-start px-3 py-1.5 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font cursor-pointer hover:bg-light-hover dark:hover:bg-dark-hover text-sm"
          >
            Search TMDB
          </button>
        }
      </div>
    </div>
  `,
})
export class PosterPickerComponent {
  private tmdbSuggestionService = inject(TmdbSuggestionService);
  private imageStorage = inject(ImageStorageService);
  private destroyRef = inject(DestroyRef);

  readonly posterId = input<string | undefined>(undefined);
  readonly posterIdChange = output<string | undefined>();
  readonly loadingChange = output<boolean>();

  readonly posterSearchQuery = signal('');
  readonly posterSuggestions = signal<TmdbSuggestion[]>([]);
  readonly posterSuggestionsLoading = signal(false);
  readonly posterSuggestionsError = signal('');
  readonly showPosterSearch = signal(false);
  readonly posterLoading = signal(false);
  readonly posterError = signal('');
  readonly posterPreviewUrl = signal<string | null>(null);
  readonly posterPlaceholderUrl = signal(getPlaceholderUrl());

  private posterRequestId = 0;
  private readonly draftPosterIds = new Set<string>();
  private destroyed = false;
  private skipDraftCleanup = false;

  private readonly tmdb = createTmdbSearchStream(
    (query) => this.tmdbSuggestionService.search(query),
    'TMDB search unavailable.',
    {
      debounceMs: 300,
      onLoadingChange: (loading) => this.posterSuggestionsLoading.set(loading),
      onError: (message) => this.posterSuggestionsError.set(message),
    },
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.posterRequestId++;
      if (!this.skipDraftCleanup) this.deleteDraftPosters();
    });

    effect(() => {
      const posterId = this.posterId();
      const version = this.imageStorage.version();
      void this.loadPosterPreview(posterId, version);
    });

    this.tmdb.results.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((results) => {
      this.posterSuggestions.set(results.filter((suggestion) => suggestion.posterPath));
    });
  }

  getPosterThumbUrl(posterPath: string): string | null {
    return getPosterUrl(posterPath);
  }

  onPosterSearchChanged(query: string): void {
    this.posterSearchQuery.set(query);
    this.tmdb.query.next(query);
  }

  selectPosterFromTmdb(suggestion: TmdbSuggestion): void {
    if (suggestion.posterPath) {
      void this.storePoster(this.imageStorage.storeUrl(getPosterUrl(suggestion.posterPath) ?? ''));
    }
    this.posterSearchQuery.set('');
    this.tmdb.query.next('');
    this.posterSuggestions.set([]);
    this.showPosterSearch.set(false);
  }

  storeFromTmdbPath(posterPath: string | null | undefined): void {
    if (posterPath) {
      void this.storePoster(this.imageStorage.storeUrl(getPosterUrl(posterPath) ?? ''));
    }
  }

  async uploadPoster(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await this.storePoster(this.imageStorage.storeFile(file));
  }

  clearPoster(): void {
    this.posterRequestId++;
    this.deleteDraftPoster(this.posterId());
    this.posterIdChange.emit(undefined);
    this.setLoading(false);
  }

  commitDrafts(): void {
    this.skipDraftCleanup = true;
  }

  clearDrafts(): void {
    this.posterRequestId++;
    this.deleteDraftPosters();
    this.posterIdChange.emit(undefined);
    this.setLoading(false);
  }

  private async storePoster(request: Promise<string>): Promise<void> {
    const requestId = ++this.posterRequestId;
    this.setLoading(true);
    this.posterError.set('');
    try {
      const posterId = await request;
      if (this.destroyed || requestId !== this.posterRequestId) {
        void this.imageStorage.delete(posterId);
        return;
      }
      const previousPosterId = this.posterId();
      this.draftPosterIds.add(posterId);
      this.posterIdChange.emit(posterId);
      this.deleteDraftPoster(previousPosterId);
    } catch (error) {
      if (!this.destroyed && requestId === this.posterRequestId) {
        this.posterError.set(error instanceof Error ? error.message : 'Unable to save poster.');
      }
    } finally {
      if (!this.destroyed && requestId === this.posterRequestId) this.setLoading(false);
    }
  }

  private async loadPosterPreview(
    posterId: string | undefined,
    loadedVersion: number,
  ): Promise<void> {
    const url = await this.imageStorage.getUrl(posterId);
    if (this.destroyed || posterId !== this.posterId()) {
      return;
    }
    if (loadedVersion !== this.imageStorage.version()) return;
    this.posterPreviewUrl.set(url);
  }

  private deleteDraftPoster(posterId: string | undefined): void {
    if (posterId && this.draftPosterIds.delete(posterId)) void this.imageStorage.delete(posterId);
  }

  private deleteDraftPosters(): void {
    for (const posterId of this.draftPosterIds) void this.imageStorage.delete(posterId);
    this.draftPosterIds.clear();
  }

  private setLoading(loading: boolean): void {
    this.posterLoading.set(loading);
    this.loadingChange.emit(loading);
  }
}
