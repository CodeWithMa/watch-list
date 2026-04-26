import { CommonModule } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Group } from '../../models/group.model';
import { statusBadgeClass } from '../../utils/status.utils';
import {
  createDefaultItemFormValue,
  ItemFormValue,
  normalizeFormValueForType
} from '../../domain/item-form';
import {
  ITEM_STATUSES,
  ITEM_STATUS_LABELS,
  ITEM_TYPES,
  ITEM_TYPE_LABELS
} from '../../domain/item.constants';

@Component({
  selector: 'app-item-form',
  imports: [CommonModule, FormsModule],
  template: `
    <form (ngSubmit)="submit()" #itemForm="ngForm" class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-8 rounded-lg">
      <div class="mb-6">
        <label for="title" class="block mb-2 font-medium text-light-font dark:text-dark-font">Title *</label>
        <input
          type="text"
          id="title"
          [ngModel]="title()"
          (ngModelChange)="title.set($event)"
          name="title"
          required
          class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
        />
        @if (itemForm.controls['title']?.invalid && itemForm.controls['title']?.touched) {
          <div class="text-accent-danger text-sm mt-1">Title is required</div>
        }
      </div>

      <div class="mb-6">
        <label for="type" class="block mb-2 font-medium text-light-font dark:text-dark-font">Type *</label>
        <select
          id="type"
          [ngModel]="type()"
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
          [ngModel]="groupId()"
          (ngModelChange)="groupId.set($event)"
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
                (click)="statusValue.set(status)"
                class="px-4 py-2 rounded font-medium cursor-pointer border transition-all"
                [ngClass]="statusBadgeClass(statusValue() === status, status, true)"
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
              [ngModel]="startImmediately()"
              (ngModelChange)="startImmediately.set($event)"
              name="startImmediately"
              class="w-5 h-5"
            />
            <span class="text-light-font dark:text-dark-font">Start watching immediately</span>
          </label>
        </div>
      }

      @if (type() === 'series') {
        <div class="border-t border-light-border dark:border-dark-border pt-6 mt-6">
          <div class="mb-6">
            <label for="season" class="block mb-2 font-medium text-light-font dark:text-dark-font">Season</label>
            <input
              type="number"
              id="season"
              [ngModel]="season()"
              (ngModelChange)="season.set(toPositiveNumber($event, 1))"
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
              [ngModel]="episode()"
              (ngModelChange)="episode.set(toPositiveNumber($event, 1))"
              name="episode"
              min="1"
              class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
            />
          </div>
          <div class="mb-6">
            <label for="totalEpisodes" class="block mb-2 font-medium text-light-font dark:text-dark-font">Total Episodes (optional)</label>
            <input
              type="number"
              id="totalEpisodes"
              [ngModel]="totalEpisodes()"
              (ngModelChange)="totalEpisodes.set(toOptionalPositiveNumber($event))"
              name="totalEpisodes"
              min="1"
              class="w-full p-3 border border-light-border dark:border-dark-border rounded text-base box-border bg-light-bg-secondary dark:bg-dark-bg-secondary text-light-font dark:text-dark-font focus:outline-none focus:border-accent-primary focus:shadow-[0_0_0_2px_rgba(0,123,255,0.25)]"
            />
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
          [disabled]="itemForm.invalid || !title().trim()"
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

  readonly submitted = output<ItemFormValue>();
  readonly cancelled = output<void>();

  readonly itemTypes = ITEM_TYPES;
  readonly itemStatuses = ITEM_STATUSES;
  readonly itemTypeLabels = ITEM_TYPE_LABELS;
  readonly itemStatusLabels = ITEM_STATUS_LABELS;
  readonly statusBadgeClass = statusBadgeClass;

  readonly title = signal('');
  readonly type = signal<ItemFormValue['type']>('series');
  readonly groupId = signal('');
  readonly statusValue = signal<ItemFormValue['status']>('not-started');
  readonly season = signal(1);
  readonly episode = signal(1);
  readonly totalEpisodes = signal<number | undefined>(undefined);
  readonly startImmediately = signal(false);

  readonly currentValue = computed<ItemFormValue>(() =>
    normalizeFormValueForType({
      title: this.title(),
      type: this.type(),
      groupId: this.groupId(),
      status: this.statusValue(),
      season: this.season(),
      episode: this.episode(),
      totalEpisodes: this.totalEpisodes(),
      startImmediately: this.startImmediately()
    })
  );

  readonly isDirty = computed(() => {
    const current = this.currentValue();
    const initial = normalizeFormValueForType(this.initialValue());
    return JSON.stringify(current) !== JSON.stringify(initial);
  });

  constructor() {
    effect(() => {
      this.applyValue(this.initialValue());
    });
  }

  setType(type: ItemFormValue['type']): void {
    this.type.set(type);

    if (type === 'movie') {
      this.season.set(1);
      this.episode.set(1);
      this.totalEpisodes.set(undefined);
    }
  }

  submit(): void {
    const value = this.currentValue();
    if (!value.title.trim()) {
      return;
    }

    this.submitted.emit({
      ...value,
      title: value.title.trim()
    });
  }

  handleCancel(): void {
    if (this.resetOnCancel()) {
      this.applyValue(this.initialValue());
    }
    this.cancelled.emit();
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

  private applyValue(value: ItemFormValue): void {
    const normalized = normalizeFormValueForType(value);
    this.title.set(normalized.title);
    this.type.set(normalized.type);
    this.groupId.set(normalized.groupId);
    this.statusValue.set(normalized.status);
    this.season.set(normalized.season);
    this.episode.set(normalized.episode);
    this.totalEpisodes.set(normalized.totalEpisodes);
    this.startImmediately.set(normalized.startImmediately);
  }
}
