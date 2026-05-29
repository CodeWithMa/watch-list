import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { WatchListService } from '../../services/watch-list.service';
import { GroupService } from '../../services/group.service';
import { TmdbSuggestionService } from '../../services/tmdb-suggestion.service';
import { ItemFormComponent } from '../item-form/item-form.component';
import { buildItemMutationInput, createDefaultItemFormValue, ItemFormValue } from '../../domain/item-form';
import { TmdbSuggestion } from '../../models/tmdb-suggestion.model';

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
        (titleChanged)="onTitleChanged($event)"
        (suggestionSelected)="onSuggestionSelected($event)"
        (submitted)="onSubmit($event)"
        (cancelled)="cancel()"
      />
    </div>
    `
})
export class AddItemComponent {
  private watchListService = inject(WatchListService);
  private groupService = inject(GroupService);
  private tmdbSuggestionService = inject(TmdbSuggestionService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private titleChanges = new Subject<string>();

  readonly groups = this.groupService.groups;
  readonly initialValue = createDefaultItemFormValue();
  readonly title = signal('');
  readonly suggestions = signal<TmdbSuggestion[]>([]);
  readonly suggestionsLoading = signal(false);
  readonly suggestionsError = signal('');
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
    this.titleChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((title) => {
          const normalizedTitle = title.trim();
          this.suggestionsError.set('');

          if (normalizedTitle.length < 2) {
            this.suggestionsLoading.set(false);
            return this.tmdbSuggestionService.search(normalizedTitle);
          }

          this.suggestionsLoading.set(true);
          return this.tmdbSuggestionService.search(normalizedTitle).pipe(
            catchError(() => {
              this.suggestionsError.set('TMDB suggestions are unavailable.');
              return of([]);
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (suggestions) => {
          this.suggestions.set(suggestions);
          this.suggestionsLoading.set(false);
        }
      });
  }

  onTitleChanged(title: string): void {
    this.title.set(title);
    this.titleChanges.next(title);
  }

  onSuggestionSelected(suggestion: TmdbSuggestion): void {
    this.title.set(suggestion.title);
    this.suggestions.set([]);
    this.suggestionsLoading.set(false);
    this.suggestionsError.set('');
  }

  onSubmit(formValue: ItemFormValue): void {
    this.watchListService.addItem(buildItemMutationInput(formValue));

    this.router.navigate(['/items']);
  }

  cancel(): void {
    this.router.navigate(['/items']);
  }

  private normalizeTitle(title: string): string {
    return title.trim().toLocaleLowerCase();
  }
}
