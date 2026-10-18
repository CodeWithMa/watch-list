import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
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
import { isEpisodicType } from '../../domain/item.constants';
import { SearchProviderSelectComponent } from '../search-provider-select/search-provider-select.component';
import { ItemMutationFeedback } from '../item-mutation-feedback';
import { ConflictRecoveryComponent } from '../conflict-recovery/conflict-recovery.component';

interface SelectedSuggestionRef {
  source: SuggestionSource;
  id: number;
}

@Component({
  selector: 'app-add-item',
  imports: [ItemFormComponent, SearchProviderSelectComponent, ConflictRecoveryComponent],
  template: `
    <div>
      <h1 class="text-2xl mb-8 text-light-font dark:text-dark-font">Add New Item</h1>
      <app-conflict-recovery [disabled]="mutation.busy()" (recovered)="mutation.error.set(null)" />

      <app-item-form
        [groups]="groups()"
        [initialValue]="initialValue"
        [focusTitleOnOpen]="true"
        submitLabel="Add Item"
        [busy]="mutation.busy()"
        [error]="mutation.error()"
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
      >
        <app-search-provider-select
          title-search-provider
          [sources]="enabledSources()"
          [value]="selectedSource()"
          label="Title search provider"
          (valueChange)="onSearchProviderChanged($event)"
        />
      </app-item-form>
    </div>
  `,
})
export class AddItemComponent {
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);
  private suggestionSearchService = inject(SuggestionSearchService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private readonly search = this.suggestionSearchService.createSession(
    'Suggestions are unavailable.',
  );
  private selectedEpisodicRef = new Subject<SelectedSuggestionRef | null>();

  readonly groups = this.groupService.groups;
  readonly mutation = new ItemMutationFeedback();
  readonly enabledSources = this.search.enabledSources;
  readonly selectedSource = this.search.selectedSource;
  readonly initialValue = createDefaultItemFormValue();
  readonly title = signal('');
  readonly suggestions = this.search.results;
  readonly suggestionsLoading = this.search.loading;
  readonly suggestionsError = this.search.error;
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

  onTitleChanged(title: string): void {
    this.title.set(title);
    this.autofillPatch.set(null);
    this.selectedEpisodicRef.next(null);
    this.search.setQuery(title);
  }

  onSearchProviderChanged(source: SuggestionSource): void {
    this.search.setSource(source);
  }

  onSuggestionSelected(suggestion: Suggestion): void {
    this.title.set(suggestion.title);
    this.search.dismiss(suggestion.title);

    if (!isEpisodicType(suggestion.type)) {
      this.autofillPatch.set({
        id: ++this.autofillPatchId,
        value: { season: 1, episode: 1, seasons: [] },
      });
      this.selectedEpisodicRef.next(null);
      return;
    }

    this.autofillPatch.set({
      id: ++this.autofillPatchId,
      value: { season: 1, episode: 1, seasons: [] },
    });
    this.selectedEpisodicRef.next({ source: suggestion.source, id: suggestion.id });
  }

  async onSubmit(formValue: ItemFormValue): Promise<void> {
    const result = await this.mutation.run(
      () => this.watchListService.addItem(buildItemMutationInput(formValue)),
      'Unable to add this item.',
    );
    if (result) {
      this.router.navigate(['/items']);
    }
  }

  cancel(): void {
    if (this.mutation.busy()) return;
    this.router.navigate(['/items']);
  }

  private normalizeTitle(title: string): string {
    return title.trim().toLocaleLowerCase();
  }
}
