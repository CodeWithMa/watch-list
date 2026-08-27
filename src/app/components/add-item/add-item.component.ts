import { Component, DestroyRef, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { of, Subject, switchMap } from 'rxjs';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { SuggestionSearchService } from '../../services/suggestion-search.service';
import { ItemFormComponent } from '../item-form/item-form.component';
import {
  buildItemMutationInput,
  createDefaultItemFormValue,
  ItemFormValue,
} from '../../domain/item-form';
import { Suggestion, SuggestionSource } from '../../models/suggestion.model';
import { createSearchStream } from '../../utils/search-stream.utils';
import { isEpisodicType } from '../../domain/item.constants';
import { SUGGESTION_DEBOUNCE_MS } from '../../domain/suggestion.constants';

interface SelectedSuggestionRef {
  source: SuggestionSource;
  id: number;
}

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
  @ViewChild(ItemFormComponent) private form?: ItemFormComponent;
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);
  private suggestionSearchService = inject(SuggestionSearchService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private readonly search = createSearchStream(
    (query) => this.suggestionSearchService.search(query),
    'Suggestions are unavailable.',
    {
      debounceMs: SUGGESTION_DEBOUNCE_MS,
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
  private selectedEpisodicRef = new Subject<SelectedSuggestionRef | null>();
  private skipNextSearch = false;
  private lastPushedQuery = '';

  readonly groups = this.groupService.groups;
  readonly initialValue = createDefaultItemFormValue();
  readonly title = signal('');
  readonly suggestions = signal<Suggestion[]>([]);
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
    this.search.results.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((suggestions) => {
      this.suggestions.set(suggestions);
    });

    this.selectedEpisodicRef
      .pipe(
        switchMap((ref) => {
          if (ref === null) {
            return of(null);
          }

          return this.suggestionSearchService.getDetails(ref);
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
      this.search.query.next(title);
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
    this.selectedEpisodicRef.next(null);
    this.requestTitleSearch(title);
  }

  onSuggestionSelected(suggestion: Suggestion): void {
    this.title.set(suggestion.title);
    this.skipNextSearch = true;
    this.requestTitleSearch(suggestion.title);
    this.suggestions.set([]);
    this.suggestionsLoading.set(false);
    this.suggestionsError.set('');

    if (!isEpisodicType(suggestion.type)) {
      this.selectedEpisodicRef.next(null);
      return;
    }

    this.selectedEpisodicRef.next({ source: suggestion.source, id: suggestion.id });
  }

  async onSubmit(formValue: ItemFormValue): Promise<void> {
    try {
      await this.watchListService.addItem(buildItemMutationInput(formValue));
      this.form?.commitDrafts();
      this.router.navigate(['/items']);
    } catch {
      this.form?.clearDrafts();
    }
  }

  cancel(): void {
    this.router.navigate(['/items']);
  }

  private normalizeTitle(title: string): string {
    return title.trim().toLocaleLowerCase();
  }
}
