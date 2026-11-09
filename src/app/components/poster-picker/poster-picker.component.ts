import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Suggestion, SuggestionSource } from '../../models/suggestion.model';
import { SuggestionSearchService } from '../../services/suggestion-search.service';
import { ImageStorageService } from '../../services/image-storage.service';
import { injectPosterUrl } from '../../services/poster-reader';
import { FilePickerFocusDirective } from '../../directives/file-picker-focus.directive';
import { PosterFallbackComponent } from '../poster-fallback/poster-fallback.component';
import { SearchProviderSelectComponent } from '../search-provider-select/search-provider-select.component';

@Component({
  selector: 'app-poster-picker',
  imports: [
    FormsModule,
    RouterLink,
    FilePickerFocusDirective,
    PosterFallbackComponent,
    SearchProviderSelectComponent,
  ],
  template: `
    <div class="@container">
      <div class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 items-start">
        <div
          class="w-20 sm:w-24 overflow-hidden rounded border border-light-border dark:border-dark-border @md:row-span-2"
        >
          @if (posterPreviewUrl()) {
            <img
              [src]="posterPreviewUrl()"
              alt="Poster preview"
              class="block w-full aspect-[2/3] object-cover"
            />
          } @else {
            <app-poster-fallback label="No poster" />
          }
        </div>
        <div class="flex flex-col gap-2 min-w-0">
          <div class="flex flex-wrap gap-2">
            <button type="button" (click)="posterInput.click()" class="btn btn-secondary">
              Upload image
            </button>
            @if (posterId()) {
              <button type="button" (click)="clearPoster()" class="btn btn-secondary">
                Clear poster
              </button>
            }
            <button
              #searchToggle
              type="button"
              (click)="togglePosterSearch()"
              [attr.aria-expanded]="showPosterSearch()"
              aria-controls="poster-search"
              class="btn btn-secondary"
            >
              {{ showPosterSearch() ? 'Close search' : 'Search for poster' }}
            </button>
          </div>
          <input
            type="file"
            appFilePickerFocus
            #posterInput
            accept="image/*"
            class="hidden"
            (change)="uploadPoster($event)"
            aria-label="Choose image to upload"
          />
          @if (posterLoading()) {
            <div class="text-xs text-light-font-secondary dark:text-dark-font-secondary">
              Saving poster...
            </div>
          }
          @if (posterError()) {
            <div class="text-xs text-accent-danger-text">{{ posterError() }}</div>
          }
        </div>
        <!-- Below the preview on narrow forms, so the query keeps the card's full width. -->
        <div id="poster-search" class="col-span-2 @md:col-span-1 @md:col-start-2 min-w-0">
          @if (showPosterSearch()) {
            <div class="search-input-group search-input-group-sm">
              <app-search-provider-select
                [sources]="enabledSources()"
                [value]="selectedSource()"
                label="Poster search provider"
                [sourcesNeedingSetup]="sourcesNeedingSetup()"
                (valueChange)="onSearchProviderChanged($event)"
              />
              <input
                type="text"
                [ngModel]="posterSearchQuery()"
                (ngModelChange)="onPosterSearchChanged($event)"
                name="posterSearch"
                aria-label="Search for a poster"
                placeholder="Search for a poster..."
                class="form-control-sm flex-1 min-w-0"
              />
            </div>
            @if (posterSuggestionsLoading()) {
              <div class="mt-1 text-xs text-light-font-secondary dark:text-dark-font-secondary">
                Searching...
              </div>
            } @else if (posterSuggestionsError()) {
              <div class="mt-1 text-xs text-light-font-secondary dark:text-dark-font-secondary">
                {{ posterSuggestionsError() }}
              </div>
            } @else if (
              posterSearchQuery().trim() && needsSetup() && posterSuggestions().length === 0
            ) {
              <div class="mt-1 text-xs text-light-font-secondary dark:text-dark-font-secondary">
                TMDB isn't connected yet.
                <a routerLink="/settings" class="text-accent-text underline"
                  >Connect it in Settings</a
                >, switch provider, or upload an image.
              </div>
            } @else if (posterSuggestionsEmpty()) {
              <div class="mt-1 text-xs text-light-font-secondary dark:text-dark-font-secondary">
                No posters found. Try another search or provider, or upload an image.
              </div>
            } @else if (posterSuggestions().length > 0) {
              <div
                class="mt-1 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary max-h-48 overflow-y-auto"
              >
                @for (
                  suggestion of posterSuggestions();
                  track suggestion.source + '-' + suggestion.id
                ) {
                  <button
                    type="button"
                    (click)="selectPosterSuggestion(suggestion)"
                    class="w-full text-left px-2 py-1.5 border-0 border-b border-light-border dark:border-dark-border last:border-b-0 bg-transparent hover:bg-light-hover dark:hover:bg-dark-hover cursor-pointer flex items-center gap-2"
                  >
                    @if (suggestion.posterUrl) {
                      <img
                        [src]="suggestion.posterUrl"
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
          }
        </div>
      </div>
    </div>
  `,
})
export class PosterPickerComponent {
  private suggestionSearchService = inject(SuggestionSearchService);
  private imageStorage = inject(ImageStorageService);
  private destroyRef = inject(DestroyRef);
  private readonly searchToggle = viewChild.required<ElementRef<HTMLButtonElement>>('searchToggle');
  private readonly search = this.suggestionSearchService.createSession('Search unavailable.');

  readonly posterId = input<string | undefined>(undefined);
  readonly searchSeed = input('');
  readonly posterIdChange = output<string | undefined>();
  readonly loadingChange = output<boolean>();

  readonly enabledSources = this.search.enabledSources;
  readonly selectedSource = this.search.selectedSource;
  readonly posterSearchQuery = this.search.query;
  readonly posterSuggestions = computed(() =>
    this.search.results().filter((suggestion) => suggestion.posterUrl),
  );
  readonly posterSuggestionsLoading = this.search.loading;
  readonly posterSuggestionsError = this.search.error;
  readonly sourcesNeedingSetup = this.search.sourcesNeedingSetup;
  readonly needsSetup = this.search.needsSetup;
  // Results without artwork are filtered out above, so an all-filtered list is also empty.
  readonly posterSuggestionsEmpty = computed(
    () =>
      this.search.noResults() ||
      (this.search.results().length > 0 && this.posterSuggestions().length === 0),
  );
  readonly showPosterSearch = signal(false);
  readonly posterLoading = signal(false);
  readonly posterError = signal('');
  readonly posterPreviewUrl = injectPosterUrl(this.posterId);

  private posterRequestId = 0;
  private readonly draftPosterIds = new Set<string>();
  private destroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.posterRequestId++;
      this.deleteDraftPosters();
    });
  }

  togglePosterSearch(): void {
    if (this.showPosterSearch()) {
      this.search.dismiss();
      this.showPosterSearch.set(false);
    } else {
      this.openPosterSearch();
    }
  }

  openPosterSearch(): void {
    const query = this.searchSeed().trim();
    if (query) {
      this.onPosterSearchChanged(query);
    }
    this.showPosterSearch.set(true);
  }

  onPosterSearchChanged(query: string): void {
    this.search.setQuery(query);
  }

  onSearchProviderChanged(source: SuggestionSource): void {
    this.search.setSource(source);
  }

  selectPosterSuggestion(suggestion: Suggestion): void {
    if (suggestion.posterUrl) {
      void this.storePoster(this.imageStorage.storeUrl(suggestion.posterUrl));
    }
    this.search.dismiss();
    this.showPosterSearch.set(false);
    // The chosen result is about to disappear; keep keyboard users in place.
    this.searchToggle().nativeElement.focus();
  }

  storeFromUrl(posterUrl: string | null | undefined): void {
    if (posterUrl) {
      void this.storePoster(this.imageStorage.storeUrl(posterUrl));
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
        this.imageStorage.discardDraft(posterId);
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

  private deleteDraftPoster(posterId: string | undefined): void {
    if (posterId && this.draftPosterIds.delete(posterId)) this.imageStorage.discardDraft(posterId);
  }

  private deleteDraftPosters(): void {
    for (const posterId of this.draftPosterIds) this.imageStorage.discardDraft(posterId);
    this.draftPosterIds.clear();
  }

  private setLoading(loading: boolean): void {
    this.posterLoading.set(loading);
    this.loadingChange.emit(loading);
  }
}
