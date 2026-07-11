import { CommonModule } from '@angular/common';
import { Component, computed, effect, input, linkedSignal, output, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Group } from '../../models/group.model';
import {
  createDefaultItemFormValue,
  ItemFormValue,
  normalizeFormValueForType,
  prepareSubmittedItemFormValue
} from '../../domain/item-form';
import {
  ITEM_STATUSES,
  ITEM_STATUS_LABELS,
  ITEM_TYPES,
  ITEM_TYPE_LABELS
} from '../../domain/item.constants';
import { TmdbSuggestion } from '../../models/tmdb-suggestion.model';

export interface ItemFormAutofillPatch {
  id: number;
  value: Partial<ItemFormValue>;
}

@Component({
  selector: 'app-item-form',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (ngSubmit)="submit()" #itemForm="ngForm" class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-8 rounded-lg">
      <div class="mb-6">
        <label for="title" class="block mb-2 font-medium text-light-font dark:text-dark-font">Title *</label>
        <input
          type="text"
          id="title"
          [ngModel]="formValue().title"
          (ngModelChange)="updateTitle($event)"
          name="title"
          required
          class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
        />
        @if (itemForm.controls['title']?.invalid && itemForm.controls['title']?.touched) {
          <div class="text-accent-danger text-sm mt-1">Title is required</div>
        }
        @if (duplicateTitleHint()) {
          <div class="text-accent-secondary text-sm mt-1">{{ duplicateTitleHint() }}</div>
        }
        @if (showSuggestions()) {
          <div class="mt-3 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary overflow-hidden">
            @if (suggestionsLoading()) {
              <div class="px-3 py-2 text-sm text-light-font-secondary dark:text-dark-font-secondary">Searching TMDB...</div>
            } @else if (suggestionsError()) {
              <div class="px-3 py-2 text-sm text-accent-secondary">{{ suggestionsError() }}</div>
            } @else if (suggestions().length > 0) {
              @for (suggestion of suggestions(); track suggestion.type + '-' + suggestion.tmdbId) {
                <button
                  type="button"
                  (click)="selectSuggestion(suggestion)"
                  class="w-full text-left px-3 py-3 border-0 border-b border-light-border dark:border-dark-border last:border-b-0 bg-transparent hover:bg-light-hover dark:hover:bg-dark-hover cursor-pointer"
                >
                  <span class="block text-light-font dark:text-dark-font font-medium">
                    {{ suggestion.title }}
                    @if (suggestion.year) {
                      <span class="text-light-font-muted dark:text-dark-font-muted font-normal">({{ suggestion.year }})</span>
                    }
                  </span>
                  <span class="block text-sm text-light-font-secondary dark:text-dark-font-secondary">{{ itemTypeLabels[suggestion.type] }}</span>
                  @if (suggestion.overview) {
                    <span class="block text-sm text-light-font-muted dark:text-dark-font-muted mt-1 line-clamp-2">{{ suggestion.overview }}</span>
                  }
                </button>
              }
            }
          </div>
        }
      </div>

      <div class="mb-6">
        <label for="type" class="block mb-2 font-medium text-light-font dark:text-dark-font">Type *</label>
        <select
          id="type"
          [ngModel]="formValue().type"
          (ngModelChange)="setType($event)"
          name="type"
          class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
        >
          @for (itemType of itemTypes; track itemType) {
            <option [value]="itemType">{{ itemTypeLabels[itemType] }}</option>
          }
        </select>
      </div>

      <div class="mb-6">
        <label for="groupId" class="block mb-2 font-medium text-light-font dark:text-dark-font">Group *</label>
        <select
          id="groupId"
          [ngModel]="formValue().groupId"
          (ngModelChange)="updateGroupId($event)"
          name="groupId"
          required
          class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
        >
          @for (group of groups(); track group.id) {
            <option [value]="group.id">{{ group.name }}</option>
          }
        </select>
      </div>

      @if (showStatusPicker()) {
        <div class="mb-6">
          <span class="block mb-2 font-medium text-light-font dark:text-dark-font">Status:</span>
          <div class="flex flex-wrap gap-3">
            @for (status of itemStatuses; track status) {
              <button
                type="button"
                (click)="updateStatus(status)"
                [class]="statusButtonClass(status)"
              >
                {{ itemStatusLabels[status] }}
              </button>
            }
          </div>
        </div>
      }

      @if (showStartImmediately()) {
        <div class="mb-6">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              [ngModel]="formValue().startImmediately"
              (ngModelChange)="updateStartImmediately($event)"
              name="startImmediately"
              class="w-5 h-5"
            />
            <span class="text-light-font dark:text-dark-font">Start watching immediately</span>
          </label>
        </div>
      }

      @if (formValue().type === 'series') {
        <div class="border-t border-light-border dark:border-dark-border pt-6 mt-6">
          <div class="mb-6">
            <label for="season" class="block mb-2 font-medium text-light-font dark:text-dark-font">Season</label>
            <input
              type="number"
              id="season"
              [ngModel]="formValue().season"
              (ngModelChange)="updateSeason($event)"
              name="season"
              min="1"
              class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
            />
          </div>
          <div class="mb-6">
            <label for="episode" class="block mb-2 font-medium text-light-font dark:text-dark-font">Episode</label>
            <input
              type="number"
              id="episode"
              [ngModel]="formValue().episode"
              (ngModelChange)="updateEpisode($event)"
              name="episode"
              min="1"
              class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
            />
          </div>
          <div class="mb-6">
            <h3 class="mb-4 font-medium text-light-font dark:text-dark-font">Seasons</h3>
            @for (season of formValue().seasons; track season.seasonNumber; let i = $index) {
              <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-4 items-end">
                <div class="flex-1">
                  <label for="seasonNumber{{ i }}" class="block mb-1 text-sm">Season</label>
                  <input
                    type="number"
                    id="seasonNumber{{ i }}"
                    [ngModel]="season.seasonNumber"
                    (ngModelChange)="updateSeasonNumber(i, $event)"
                    name="seasonNumber{{ i }}"
                    min="1"
                    class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary"
                  />
                </div>
                <div class="flex-1">
                  <label for="seasonEpisodes{{ i }}" class="block mb-1 text-sm">Episodes</label>
                  <input
                    type="number"
                    id="seasonEpisodes{{ i }}"
                    [ngModel]="season.totalEpisodes"
                    (ngModelChange)="updateSeasonEpisodes(i, $event)"
                    name="seasonEpisodes{{ i }}"
                    min="1"
                    class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary"
                  />
                </div>
                <div class="flex-1">
                  <label for="seasonFirstAirDate{{ i }}" class="block mb-1 text-sm">First episode air date</label>
                  <input
                    type="date"
                    id="seasonFirstAirDate{{ i }}"
                    [ngModel]="season.firstEpisodeAirDate"
                    (ngModelChange)="updateSeasonFirstAirDate(i, $event)"
                    name="seasonFirstAirDate{{ i }}"
                    class="w-full p-2 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary"
                  />
                </div>
                <button
                  type="button"
                  (click)="removeSeason(season.seasonNumber)"
                  class="px-3 py-2 bg-accent-danger text-white border-none rounded cursor-pointer text-sm hover:bg-accent-danger-hover"
                >
                  Remove
                </button>
              </div>
            }
            <button
              type="button"
              (click)="addSeason()"
              class="px-4 py-2 bg-accent-secondary text-white border-none rounded cursor-pointer text-sm hover:bg-accent-secondary-hover"
            >
              Add Season
            </button>
          </div>
        </div>
      }

      @if (showDirtyState() && isDirty()) {
        <div class="mb-4 px-3 py-2 rounded bg-light-bg-secondary dark:bg-dark-bg-secondary border border-accent-secondary text-accent-secondary text-sm">
          You have unsaved changes
        </div>
      }

      <div class="flex gap-4 mt-8">
        <button
          type="submit"
          class="px-8 py-3 bg-accent-primary text-white border-none rounded cursor-pointer text-base font-medium hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          [disabled]="isSubmitDisabled()"
        >
          {{ submitLabel() }}
        </button>
        <button
          type="button"
          (click)="handleCancel()"
          class="px-8 py-3 bg-accent-secondary text-white border-none rounded cursor-pointer text-base hover:bg-accent-secondary-hover"
        >
          {{ cancelLabel() }}
        </button>
      </div>
    </form>
  `
})
export class ItemFormComponent {
  readonly groups = input.required<Group[]>();
  readonly initialValue = input<ItemFormValue>(createDefaultItemFormValue());
  readonly submitLabel = input('Save');
  readonly cancelLabel = input('Cancel');
  readonly showStartImmediately = input(false);
  readonly showStatusPicker = input(true);
  readonly showDirtyState = input(false);
  readonly resetOnCancel = input(false);
  readonly disableSubmitWhenPristine = input(false);
  readonly duplicateTitleHint = input('');
  readonly suggestions = input<TmdbSuggestion[]>([]);
  readonly suggestionsLoading = input(false);
  readonly suggestionsError = input('');
  readonly autofillPatch = input<ItemFormAutofillPatch | null>(null);

  readonly submitted = output<ItemFormValue>();
  readonly cancelled = output<void>();
  readonly titleChanged = output<string>();
  readonly suggestionSelected = output<TmdbSuggestion>();

  readonly itemTypes = ITEM_TYPES;
  readonly itemStatuses = ITEM_STATUSES;
  readonly itemTypeLabels = ITEM_TYPE_LABELS;
  readonly itemStatusLabels = ITEM_STATUS_LABELS;

  readonly formValue = linkedSignal(() => normalizeFormValueForType(this.initialValue()));

  readonly isDirty = computed(() => {
    const current = this.formValue();
    const initial = normalizeFormValueForType(this.initialValue());
    return JSON.stringify(current) !== JSON.stringify(initial);
  });

  readonly isSubmitDisabled = computed(() => {
    if (!this.formValue().title.trim()) {
      return true;
    }

    return this.disableSubmitWhenPristine() && !this.isDirty();
  });

  readonly showSuggestions = computed(
    () => this.suggestionsLoading() || !!this.suggestionsError() || this.suggestions().length > 0
  );

  private lastAppliedAutofillPatchId: number | null = null;

  constructor() {
    effect(() => {
      const patch = this.autofillPatch();
      if (!patch || patch.id === this.lastAppliedAutofillPatchId) {
        return;
      }

      this.lastAppliedAutofillPatchId = patch.id;
      this.updateFormValue(patch.value);
    });
  }

  setType(type: ItemFormValue['type']): void {
    this.formValue.update((value) =>
      normalizeFormValueForType({
        ...value,
        type
      })
    );
  }

  submit(): void {
    const value = this.formValue();
    if (!value.title.trim()) {
      return;
    }

    const submittedValue = prepareSubmittedItemFormValue(value, this.showStartImmediately());

    this.submitted.emit({
      ...submittedValue,
      title: submittedValue.title.trim()
    });
  }

  handleCancel(): void {
    if (this.resetOnCancel()) {
      this.formValue.set(normalizeFormValueForType(this.initialValue()));
    }
    this.cancelled.emit();
  }

  updateTitle(title: string): void {
    this.updateFormValue({ title });
    this.titleChanged.emit(title);
  }

  selectSuggestion(suggestion: TmdbSuggestion): void {
    this.formValue.update((value) =>
      normalizeFormValueForType({
        ...value,
        title: suggestion.title,
        type: suggestion.type
      })
    );
    this.suggestionSelected.emit(suggestion);
  }

  updateGroupId(groupId: string): void {
    this.updateFormValue({ groupId });
  }

  updateStatus(status: ItemFormValue['status']): void {
    this.updateFormValue({ status });
  }

  updateSeason(season: string | number | null | undefined): void {
    this.updateFormValue({ season: this.toPositiveNumber(season, 1) });
  }

  updateEpisode(episode: string | number | null | undefined): void {
    this.updateFormValue({ episode: this.toPositiveNumber(episode, 1) });
  }

  updateStartImmediately(startImmediately: boolean): void {
    this.updateFormValue({ startImmediately });
  }

  addSeason(): void {
    this.formValue.update((value) => {
      const nextSeasonNumber = this.getNextSeasonNumber(value.seasons);
      return {
        ...value,
        seasons: [...value.seasons, { seasonNumber: nextSeasonNumber, totalEpisodes: undefined as number | undefined }]
      };
    });
  }

  updateSeasonNumber(index: number, seasonNumber: string | number | null | undefined): void {
    const parsed = this.toPositiveNumber(seasonNumber, 1);
    this.formValue.update((value) => {
      const newSeasons = [...value.seasons];
      if (newSeasons[index]) {
        const hasDuplicate = newSeasons.some((s, i) => i !== index && s.seasonNumber === parsed);
        if (!hasDuplicate) {
          newSeasons[index] = { ...newSeasons[index], seasonNumber: parsed };
        }
      }
      return { ...value, seasons: newSeasons };
    });
  }

  updateSeasonEpisodes(index: number, totalEpisodes: string | number | null | undefined): void {
    const parsed = this.toOptionalPositiveNumber(totalEpisodes);
    this.formValue.update((value) => {
      const newSeasons = [...value.seasons];
      if (newSeasons[index]) {
        newSeasons[index] = { ...newSeasons[index], totalEpisodes: parsed };
      }
      return { ...value, seasons: newSeasons };
    });
  }

  updateSeasonFirstAirDate(index: number, firstEpisodeAirDate: string | null | undefined): void {
    const normalized = this.toOptionalDateString(firstEpisodeAirDate);
    this.formValue.update((value) => {
      const newSeasons = [...value.seasons];
      if (newSeasons[index]) {
        newSeasons[index] = {
          ...newSeasons[index],
          firstEpisodeAirDate: normalized
        };
      }
      return { ...value, seasons: newSeasons };
    });
  }

  removeSeason(seasonNumber: number): void {
    this.formValue.update((value) => ({
      ...value,
      seasons: value.seasons.filter((s) => s.seasonNumber !== seasonNumber)
    }));
  }

  private getNextSeasonNumber(seasons: { seasonNumber: number }[]): number {
    if (seasons.length === 0) return 1;
    const max = Math.max(...seasons.map((s) => s.seasonNumber));
    return max + 1;
  }

  statusButtonClass(status: ItemFormValue['status']): string {
    const base = 'px-4 py-2 rounded font-medium cursor-pointer border transition-all';
    const unselected =
      'bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font border-light-border dark:border-dark-border hover:border-accent-primary';
    const selected = 'shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] border-transparent';

    if (this.formValue().status !== status) {
      return `${base} ${unselected}`;
    }

    switch (status) {
      case 'not-started':
        return `${base} ${selected} bg-status-not-started-bg-light dark:bg-status-not-started-bg-dark text-status-not-started-text-light dark:text-status-not-started-text-dark`;
      case 'in-progress':
        return `${base} ${selected} bg-status-in-progress-bg-light dark:bg-status-in-progress-bg-dark text-status-in-progress-text-light dark:text-status-in-progress-text-dark`;
      case 'completed':
        return `${base} ${selected} bg-status-completed-bg-light dark:bg-status-completed-bg-dark text-status-completed-text-light dark:text-status-completed-text-dark`;
      case 'dropped':
        return `${base} ${selected} bg-status-dropped-bg-light dark:bg-status-dropped-bg-dark text-status-dropped-text-light dark:text-status-dropped-text-dark`;
    }
  }

  protected toPositiveNumber(value: string | number | null | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
  }

  protected toOptionalPositiveNumber(value: string | number | null | undefined): number | undefined {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : undefined;
  }

  protected toOptionalDateString(value: string | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  }

  private updateFormValue(patch: Partial<ItemFormValue>): void {
    this.formValue.update((value) =>
      normalizeFormValueForType({
        ...value,
        ...patch
      })
    );
  }
}
