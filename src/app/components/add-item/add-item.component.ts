import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, of, Subject, switchMap } from 'rxjs';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { TmdbSuggestionService } from '../../services/tmdb-suggestion.service';
import { ItemFormComponent } from '../item-form/item-form.component';
import {
  buildItemMutationInput,
  createDefaultItemFormValue,
  ItemFormValue,
} from '../../domain/item-form';
import { TmdbSuggestion } from '../../models/tmdb-suggestion.model';
import { createTmdbSearchStream } from '../../utils/tmdb-search.utils';

@Component({
  selector: 'app-add-item',
  imports: [ItemFormComponent],
  template: `
    <div class="max-w-[600px] mx-auto p-8">
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Add New Item</h1>

      <app-item-form
        [groups]="groups()"
        [initialValue]="initialValue"
        submitLabel="Add Item"
        [showStartImmediately]="true"
        [showStatusPicker]="false"
        [duplicateTitleHint]="duplicateTitleHint()"
        [suggestions]="suggestions()"
        [suggestionsLoading]="suggestionsLoading()"
        [suggestionsError]="suggestionsError()"
        [autofillPatch]="autofillPatch()"
        (titleChanged)="onTitleChanged($event)"
        (suggestionSelected)="onSuggestionSelected($event)"
        (submitted)="onSubmit($event)"
        (cancelled)="cancel()"
      />
    </div>
  `,
})
export class AddItemComponent {
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);
  private tmdbSuggestionService = inject(TmdbSuggestionService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private readonly tmdb = createTmdbSearchStream(
    (query) => this.tmdbSuggestionService.search(query),
    'TMDB suggestions are unavailable.',
    {
      debounceMs: 250,
      distinct: true,
      shouldSkip: () => {
        const skip = this.skipNextSearch;
        this.skipNextSearch = false;
        return skip;
      },
      onLoadingChange: (loading) => this.suggestionsLoading.set(loading),
      onError: (message) => this.suggestionsError.set(message),
    },
  );
  private selectedTmdbSeriesIds = new Subject<number | null>();
  private skipNextSearch = false;
  private lastPushedQuery = '';

  readonly groups = this.groupService.groups;
  readonly initialValue = createDefaultItemFormValue();
  readonly title = signal('');
  readonly suggestions = signal<TmdbSuggestion[]>([]);
  readonly suggestionsLoading = signal(false);
  readonly suggestionsError = signal('');
  readonly autofillPatch = signal<{ id: number; value: Partial<ItemFormValue> } | null>(null);
  private autofillPatchId = 0;
  readonly duplicateTitleHint = computed(() => {
    const normalizedTitle = this.normalizeTitle(this.title());
    if (!normalizedTitle) {
      return '';
    }

    const duplicate = this.watchListService
      .items()
      .find((item) => this.normalizeTitle(item.title) === normalizedTitle);

    return duplicate ? `An item named "${duplicate.title}" already exists.` : '';
  });

  constructor() {
    this.tmdb.results.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((suggestions) => {
      this.suggestions.set(suggestions);
    });

    this.selectedTmdbSeriesIds
      .pipe(
        switchMap((tmdbId) => {
          if (tmdbId === null) {
            return of(null);
          }

          return this.tmdbSuggestionService
            .getSeriesDetails(tmdbId)
            .pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((details) => {
        if (!details) {
          return;
        }

        this.autofillPatch.set({
          id: ++this.autofillPatchId,
          value: {
            seasons: details.seasons,
          },
        });
      });
  }

  private requestTitleSearch(title: string): void {
    const trimmed = title.trim();
    const isDuplicate = trimmed === this.lastPushedQuery;
    if (!isDuplicate) {
      this.lastPushedQuery = trimmed;
      this.tmdb.query.next(title);
    }
    if (this.skipNextSearch && isDuplicate) {
      this.skipNextSearch = false;
      this.suggestions.set([]);
      this.suggestionsLoading.set(false);
      this.suggestionsError.set('');
    }
  }

  onTitleChanged(title: string): void {
    this.title.set(title);
    this.autofillPatch.set(null);
    this.selectedTmdbSeriesIds.next(null);
    this.requestTitleSearch(title);
  }

  onSuggestionSelected(suggestion: TmdbSuggestion): void {
    this.title.set(suggestion.title);
    this.skipNextSearch = true;
    this.requestTitleSearch(suggestion.title);
    this.suggestions.set([]);
    this.suggestionsLoading.set(false);
    this.suggestionsError.set('');

    if (suggestion.type !== 'series') {
      this.selectedTmdbSeriesIds.next(null);
      return;
    }

    this.selectedTmdbSeriesIds.next(suggestion.tmdbId);
  }

  async onSubmit(formValue: ItemFormValue): Promise<void> {
    await this.watchListService.addItem(buildItemMutationInput(formValue));
    this.router.navigate(['/items']);
  }

  cancel(): void {
    this.router.navigate(['/items']);
  }

  private normalizeTitle(title: string): string {
    return title.trim().toLocaleLowerCase();
  }
}
