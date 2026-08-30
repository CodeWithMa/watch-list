import { CommonModule } from '@angular/common';
import {
  Component,
  ViewChild,
  computed,
  effect,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Group } from '../../models/group.model';
import { ItemStatus, SeasonInfo } from '../../models/item.model';
import { Suggestion } from '../../models/suggestion.model';
import {
  createDefaultItemFormValue,
  ItemFormValue,
  normalizeFormValueForType,
  prepareSubmittedItemFormValue,
} from '../../domain/item-form';
import {
  ITEM_STATUSES,
  ITEM_STATUS_LABELS,
  ITEM_TYPES,
  ITEM_TYPE_LABELS,
} from '../../domain/item.constants';
import { SeasonEditorComponent } from '../season-editor/season-editor.component';
import { PosterPickerComponent } from '../poster-picker/poster-picker.component';
import { statusButtonClass } from '../../utils/status.utils';
import { toPositiveNumber } from '../../utils/form.utils';
import { isEpisodicType } from '../../domain/item.constants';

export interface ItemFormAutofillPatch {
  id: number;
  value: Partial<ItemFormValue>;
}

@Component({
  selector: 'app-item-form',
  imports: [CommonModule, FormsModule, SeasonEditorComponent, PosterPickerComponent],
  template: `
    <form
      (ngSubmit)="submit()"
      #itemForm="ngForm"
      class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-8 rounded-lg"
    >
      <div class="mb-6">
        <label for="title" class="block mb-2 font-medium text-light-font dark:text-dark-font"
          >Title *</label
        >
        <input
          type="text"
          id="title"
          [ngModel]="formValue().title"
          (ngModelChange)="updateTitle($event)"
          name="title"
          required
          class="form-control"
        />
        @if (itemForm.controls['title']?.invalid && itemForm.controls['title']?.touched) {
          <div class="text-accent-danger text-sm mt-1">Title is required</div>
        }
        @if (duplicateTitleHint()) {
          <div class="text-accent-secondary text-sm mt-1">{{ duplicateTitleHint() }}</div>
        }
        @if (showSuggestions()) {
          <div
            class="mt-3 border border-light-border dark:border-dark-border rounded bg-light-bg-secondary dark:bg-dark-bg-secondary overflow-hidden"
          >
            @if (suggestionsLoading()) {
              <div
                class="px-3 py-2 text-sm text-light-font-secondary dark:text-dark-font-secondary"
              >
                Searching...
              </div>
            } @else if (suggestionsError()) {
              <div class="px-3 py-2 text-sm text-accent-secondary">{{ suggestionsError() }}</div>
            } @else if (suggestions().length > 0) {
              @for (suggestion of suggestions(); track suggestion.source + '-' + suggestion.id) {
                <button
                  type="button"
                  (click)="selectSuggestion(suggestion)"
                  class="w-full text-left px-3 py-3 border-0 border-b border-light-border dark:border-dark-border last:border-b-0 bg-transparent hover:bg-light-hover dark:hover:bg-dark-hover cursor-pointer"
                >
                  <span class="block text-light-font dark:text-dark-font font-medium">
                    {{ suggestion.title }}
                    @if (suggestion.year) {
                      <span class="text-light-font-muted dark:text-dark-font-muted font-normal"
                        >({{ suggestion.year }})</span
                      >
                    }
                  </span>
                  <span
                    class="block text-sm text-light-font-secondary dark:text-dark-font-secondary"
                    >{{ itemTypeLabels[suggestion.type] }} ·
                    {{
                      suggestion.source === 'jikan'
                        ? 'Jikan'
                        : suggestion.source === 'anilist'
                          ? 'AniList'
                          : 'TMDB'
                    }}</span
                  >
                  @if (suggestion.overview) {
                    <span
                      class="block text-sm text-light-font-muted dark:text-dark-font-muted mt-1 line-clamp-2"
                      >{{ suggestion.overview }}</span
                    >
                  }
                </button>
              }
            }
          </div>
        }
      </div>

      <div class="mb-6">
        <span class="block mb-2 font-medium text-light-font dark:text-dark-font">Poster</span>
        <app-poster-picker
          [posterId]="formValue().posterId"
          [searchSeed]="formValue().title"
          (posterIdChange)="updatePosterId($event)"
          (loadingChange)="posterLoading.set($event)"
          #posterPicker
        />
      </div>

      <div class="mb-6">
        <label for="type" class="block mb-2 font-medium text-light-font dark:text-dark-font"
          >Type *</label
        >
        <select
          id="type"
          [ngModel]="formValue().type"
          (ngModelChange)="setType($event)"
          name="type"
          class="form-control"
        >
          @for (itemType of itemTypes; track itemType) {
            <option [value]="itemType">{{ itemTypeLabels[itemType] }}</option>
          }
        </select>
      </div>

      <div class="mb-6">
        <label for="groupId" class="block mb-2 font-medium text-light-font dark:text-dark-font"
          >Group *</label
        >
        <select
          id="groupId"
          [ngModel]="formValue().groupId"
          (ngModelChange)="updateGroupId($event)"
          name="groupId"
          required
          class="form-control"
        >
          @for (group of groups(); track group.id) {
            <option [value]="group.id">{{ group.name }}</option>
          }
        </select>
      </div>

      <div class="mb-6">
        <label class="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            id="isAdult"
            [ngModel]="formValue().isAdult"
            (ngModelChange)="updateIsAdult($event)"
            name="isAdult"
            class="w-5 h-5"
          />
          <span class="text-light-font dark:text-dark-font">Adult content</span>
        </label>
        <p class="mt-1 text-xs text-light-font-secondary dark:text-dark-font-secondary">
          Mark as adult / NSFW. Autofilled from suggestions but editable.
        </p>
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

      @if (isEpisodic(formValue().type)) {
        <div class="border-t border-light-border dark:border-dark-border pt-6 mt-6">
          <div class="mb-6">
            <label for="season" class="block mb-2 font-medium text-light-font dark:text-dark-font"
              >Season</label
            >
            <input
              type="number"
              id="season"
              [ngModel]="formValue().season"
              (ngModelChange)="updateSeason($event)"
              name="season"
              min="1"
              class="form-control"
            />
          </div>
          <div class="mb-6">
            <label for="episode" class="block mb-2 font-medium text-light-font dark:text-dark-font"
              >Episode</label
            >
            <input
              type="number"
              id="episode"
              [ngModel]="formValue().episode"
              (ngModelChange)="updateEpisode($event)"
              name="episode"
              min="1"
              class="form-control"
            />
          </div>
          <app-season-editor
            [seasons]="formValue().seasons"
            (seasonsChange)="updateSeasons($event)"
          />
        </div>
      }

      @if (showDirtyState() && isDirty()) {
        <div
          class="mb-4 px-3 py-2 rounded bg-light-bg-secondary dark:bg-dark-bg-secondary border border-accent-secondary text-accent-secondary text-sm"
        >
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
  `,
})
export class ItemFormComponent {
  @ViewChild('posterPicker') private posterPicker?: PosterPickerComponent;

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
  readonly suggestions = input<Suggestion[]>([]);
  readonly suggestionsLoading = input(false);
  readonly suggestionsError = input('');
  readonly autofillPatch = input<ItemFormAutofillPatch | null>(null);

  readonly submitted = output<ItemFormValue>();
  readonly cancelled = output<void>();
  readonly titleChanged = output<string>();
  readonly suggestionSelected = output<Suggestion>();

  readonly itemTypes = ITEM_TYPES;
  readonly itemStatuses: readonly ItemStatus[] = ITEM_STATUSES;
  readonly itemTypeLabels = ITEM_TYPE_LABELS;
  readonly itemStatusLabels = ITEM_STATUS_LABELS;

  readonly posterLoading = signal(false);
  readonly isEpisodic = isEpisodicType;

  readonly formValue = linkedSignal(() => normalizeFormValueForType(this.initialValue()));

  updateSeasons(value: SeasonInfo[]): void {
    this.formValue.update((v) => ({ ...v, seasons: value }));
  }

  readonly isDirty = computed(() => {
    const current = this.formValue();
    const initial = normalizeFormValueForType(this.initialValue());
    return JSON.stringify(current) !== JSON.stringify(initial);
  });

  readonly isSubmitDisabled = computed(() => {
    if (!this.formValue().title.trim() || this.posterLoading()) {
      return true;
    }

    return this.disableSubmitWhenPristine() && !this.isDirty();
  });

  readonly showSuggestions = computed(
    () => this.suggestionsLoading() || !!this.suggestionsError() || this.suggestions().length > 0,
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
    this.formValue.update((value) => {
      const next = normalizeFormValueForType({
        ...value,
        type,
      });
      return next;
    });
  }

  submit(): void {
    const value = this.formValue();
    if (!value.title.trim() || this.posterLoading()) {
      return;
    }

    const submittedValue = prepareSubmittedItemFormValue(value, this.showStartImmediately());

    this.submitted.emit({
      ...submittedValue,
      title: submittedValue.title.trim(),
    });
  }

  commitDrafts(): void {
    this.posterPicker?.commitDrafts();
  }

  clearDrafts(): void {
    this.posterPicker?.clearDrafts();
  }

  handleCancel(): void {
    this.posterPicker?.clearDrafts();
    if (this.resetOnCancel()) {
      this.formValue.set(normalizeFormValueForType(this.initialValue()));
    }
    this.cancelled.emit();
  }

  updateTitle(title: string): void {
    this.updateFormValue({ title });
    this.titleChanged.emit(title);
  }

  selectSuggestion(suggestion: Suggestion): void {
    this.formValue.update((value) =>
      normalizeFormValueForType({
        ...value,
        title: suggestion.title,
        type: suggestion.type,
        isAdult: suggestion.isAdult,
      }),
    );
    this.posterPicker?.storeFromUrl(suggestion.posterUrl);
    this.suggestionSelected.emit(suggestion);
  }

  updatePosterId(posterId: string | undefined): void {
    this.updateFormValue({ posterId });
  }

  updateGroupId(groupId: string): void {
    this.updateFormValue({ groupId });
  }

  updateStatus(status: ItemFormValue['status']): void {
    this.updateFormValue({ status });
  }

  updateSeason(season: string | number | null | undefined): void {
    this.updateFormValue({ season: toPositiveNumber(season, 1) });
  }

  updateEpisode(episode: string | number | null | undefined): void {
    this.updateFormValue({ episode: toPositiveNumber(episode, 1) });
  }

  updateStartImmediately(startImmediately: boolean): void {
    this.updateFormValue({ startImmediately });
  }

  updateIsAdult(isAdult: boolean): void {
    this.updateFormValue({ isAdult: !!isAdult });
  }

  statusButtonClass(status: ItemFormValue['status']): string {
    return statusButtonClass(this.formValue().status === status, status);
  }

  private updateFormValue(patch: Partial<ItemFormValue>): void {
    this.formValue.update((value) => {
      const next = normalizeFormValueForType({
        ...value,
        ...patch,
      });
      return next;
    });
  }
}
