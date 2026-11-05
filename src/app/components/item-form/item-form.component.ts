import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewChild,
  afterNextRender,
  computed,
  effect,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
import { toPositiveNumber } from '../../utils/form.utils';
import { isEpisodicType } from '../../domain/item.constants';

export interface ItemFormAutofillPatch {
  id: number;
  value: Partial<ItemFormValue>;
}

@Component({
  selector: 'app-item-form',
  imports: [CommonModule, FormsModule, RouterLink, SeasonEditorComponent, PosterPickerComponent],
  template: `
    <form (ngSubmit)="submit()" #itemForm="ngForm" class="card p-4 sm:p-6 max-w-3xl">
      <fieldset [disabled]="busy()" class="border-0 p-0 m-0 min-w-0">
        <div class="mb-4">
          <label for="title" class="block mb-2 font-medium text-light-font dark:text-dark-font"
            >Title *</label
          >
          <input
            #titleInput
            type="text"
            id="title"
            [ngModel]="formValue().title"
            (ngModelChange)="updateTitle($event)"
            name="title"
            required
            class="form-control"
          />
          <div
            class="hidden has-[app-search-provider-select:not(.hidden)]:flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 [--search-control-size:2.75rem] md:[--search-control-size:2.5rem]"
          >
            <span class="meta">Suggestions from</span>
            <ng-content select="[title-search-provider]" />
          </div>
          @if (itemForm.controls['title']?.invalid && itemForm.controls['title']?.touched) {
            <div class="text-accent-danger-text text-sm mt-1">Title is required</div>
          }
          @if (duplicateTitleHint()) {
            <div class="text-light-font-secondary dark:text-dark-font-secondary text-sm mt-1">
              {{ duplicateTitleHint() }}
            </div>
          }
          @if (searchSetupRequired() && suggestions().length === 0) {
            <p class="mt-2 mb-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
              TMDB needs setup, so it can't suggest titles yet.
              <a routerLink="/settings" class="text-accent-text underline">Connect it in Settings</a
              >, switch provider, or enter the title manually.
            </p>
          } @else if (suggestionsEmpty()) {
            <p class="mt-2 mb-0 text-sm text-light-font-secondary dark:text-dark-font-secondary">
              No suggestions found. You can still add this title manually.
            </p>
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
                <div
                  class="px-3 py-2 text-sm text-light-font-secondary dark:text-dark-font-secondary"
                >
                  {{ suggestionsError() }}
                </div>
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

        <div class="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-3 mb-4">
          <div>
            <label for="type" class="block mb-2 font-medium text-light-font dark:text-dark-font"
              >Type</label
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
          <div>
            <label for="groupId" class="block mb-2 font-medium text-light-font dark:text-dark-font"
              >Group</label
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
        </div>

        @if (showStatusPicker()) {
          <div class="mb-4">
            <span class="block mb-2 font-medium text-light-font dark:text-dark-font">Status</span>
            <div class="flex flex-wrap gap-2">
              @for (status of itemStatuses; track status) {
                <button
                  type="button"
                  (click)="updateStatus(status)"
                  [attr.aria-pressed]="formValue().status === status"
                  class="chip"
                >
                  {{ itemStatusLabels[status] }}
                </button>
              }
            </div>
          </div>
        }

        @if (showStartImmediately()) {
          <div class="mb-4">
            <label class="choice-row">
              <input
                type="checkbox"
                [ngModel]="formValue().startImmediately"
                (ngModelChange)="updateStartImmediately($event)"
                name="startImmediately"
              />
              <span>Start watching immediately</span>
            </label>
          </div>
        }

        <details
          class="form-section"
          [open]="showStatusPicker() || !!formValue().posterId || formValue().isAdult"
        >
          <summary>Poster and adult content (optional)</summary>
          <div>
            <app-poster-picker
              [posterId]="formValue().posterId"
              [searchSeed]="formValue().title"
              (posterIdChange)="updatePosterId($event)"
              (loadingChange)="posterLoading.set($event)"
              #posterPicker
            />
            <label class="choice-row mt-4">
              <input
                type="checkbox"
                id="isAdult"
                [ngModel]="formValue().isAdult"
                (ngModelChange)="updateIsAdult($event)"
                name="isAdult"
              />
              <span>Adult content</span>
            </label>
          </div>
        </details>

        @if (isEpisodic(formValue().type)) {
          <details class="form-section" [open]="showProgressSection()">
            <summary>
              {{ showStatusPicker() ? 'Progress' : 'Starting progress (optional)' }}
            </summary>
            <div>
              <p class="mt-0 mb-3 text-sm text-light-font-secondary dark:text-dark-font-secondary">
                The next episode to watch. New titles start at season 1, episode 1.
              </p>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label
                    for="season"
                    class="block mb-2 font-medium text-light-font dark:text-dark-font"
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
                <div>
                  <label
                    for="episode"
                    class="block mb-2 font-medium text-light-font dark:text-dark-font"
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
              </div>
            </div>
          </details>
          <details
            #seasonDetails
            id="season-details"
            class="form-section"
            [open]="formValue().seasons.length > 0 || revealSeasonDetails()"
          >
            <summary>Season details (optional)</summary>
            <div>
              <p class="mt-0 mb-3 text-sm text-light-font-secondary dark:text-dark-font-secondary">
                Episode counts and air dates help recommend only episodes that have aired.
              </p>
              <app-season-editor
                [seasons]="formValue().seasons"
                (seasonsChange)="updateSeasons($event)"
              />
            </div>
          </details>
          @if (hasInvalidProgress()) {
            <div role="alert" class="text-accent-danger-text text-sm mb-4">
              Season and episode values must be positive whole numbers within the supported range.
            </div>
          }
        }

        @if (showDirtyState() && isDirty()) {
          <div
            class="mb-4 px-3 py-2 rounded bg-light-bg-secondary dark:bg-dark-bg-secondary border border-accent-secondary text-light-font-secondary dark:text-dark-font-secondary text-sm"
          >
            You have unsaved changes
          </div>
        }

        @if (error()) {
          <div role="alert" class="text-accent-danger-text mt-4">{{ error() }}</div>
        }
        <div class="flex flex-wrap gap-2 mt-6">
          <button type="submit" class="btn btn-primary" [disabled]="isSubmitDisabled()">
            {{ submitLabel() }}
          </button>
          <button type="button" (click)="handleCancel()" class="btn btn-secondary">
            {{ cancelLabel() }}
          </button>
        </div>
      </fieldset>
    </form>
  `,
})
export class ItemFormComponent {
  @ViewChild('posterPicker') private posterPicker?: PosterPickerComponent;
  private readonly titleInput = viewChild.required<ElementRef<HTMLInputElement>>('titleInput');
  private readonly seasonDetails = viewChild<ElementRef<HTMLElement>>('seasonDetails');

  readonly groups = input.required<readonly Readonly<Group>[]>();
  readonly initialValue = input<ItemFormValue>(createDefaultItemFormValue());
  readonly focusTitleOnOpen = input(false);
  readonly revealSeasonDetails = input(false);
  readonly submitLabel = input('Save');
  readonly busy = input(false);
  readonly error = input<string | null>(null);
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
  readonly suggestionsEmpty = input(false);
  readonly searchSetupRequired = input(false);
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

  readonly hasInvalidProgress = computed(() => {
    const value = this.formValue();
    if (!isEpisodicType(value.type)) return false;
    const numbers = [value.season, value.episode];
    for (const season of value.seasons) {
      numbers.push(season.seasonNumber);
      if (season.totalEpisodes !== undefined) numbers.push(season.totalEpisodes);
    }
    return numbers.some((number) => !Number.isSafeInteger(number) || number < 1);
  });

  readonly isSubmitDisabled = computed(() => {
    if (
      this.busy() ||
      !this.formValue().title.trim() ||
      this.posterLoading() ||
      this.hasInvalidProgress()
    ) {
      return true;
    }

    return this.disableSubmitWhenPristine() && !this.isDirty();
  });

  readonly showProgressSection = computed(
    () => this.formValue().startImmediately || this.showStatusPicker(),
  );

  readonly showSuggestions = computed(
    () => this.suggestionsLoading() || !!this.suggestionsError() || this.suggestions().length > 0,
  );

  private lastAppliedAutofillPatchId: number | null = null;

  constructor() {
    afterNextRender(() => {
      if (this.focusTitleOnOpen()) {
        this.titleInput().nativeElement.focus();
      }
      if (this.revealSeasonDetails()) {
        this.seasonDetails()?.nativeElement.scrollIntoView();
      }
    });

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
    if (this.isSubmitDisabled()) {
      return;
    }

    const submittedValue = prepareSubmittedItemFormValue(value, this.showStartImmediately());

    this.submitted.emit({
      ...submittedValue,
      title: submittedValue.title.trim(),
    });
  }

  clearDrafts(): void {
    this.posterPicker?.clearDrafts();
  }

  handleCancel(): void {
    if (this.busy()) return;
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
