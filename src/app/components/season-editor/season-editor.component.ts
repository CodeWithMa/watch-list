import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SeasonInfo } from '../../models/item.model';
import {
  toPositiveNumber,
  toOptionalPositiveNumber,
  toOptionalDateString,
} from '../../utils/form.utils';

@Component({
  selector: 'app-season-editor',
  imports: [FormsModule],
  template: `
    <div class="border-t border-light-border dark:border-dark-border pt-6 mt-6">
      <div class="mb-6">
        <h3 class="mb-4 font-medium text-light-font dark:text-dark-font">Seasons</h3>
        @for (season of seasons(); track season.seasonNumber; let i = $index) {
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
                class="form-control-sm"
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
                class="form-control-sm"
              />
            </div>
            <div class="flex-1">
              <label for="seasonFirstAirDate{{ i }}" class="block mb-1 text-sm"
                >First episode air date</label
              >
              <input
                type="date"
                id="seasonFirstAirDate{{ i }}"
                [ngModel]="season.firstEpisodeAirDate"
                (ngModelChange)="updateSeasonFirstAirDate(i, $event)"
                name="seasonFirstAirDate{{ i }}"
                class="form-control-sm"
              />
            </div>
            <button
              type="button"
              (click)="removeSeason(i)"
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
  `,
})
export class SeasonEditorComponent {
  readonly seasons = input.required<SeasonInfo[]>();
  readonly seasonsChange = output<SeasonInfo[]>();

  addSeason(): void {
    this.seasonsChange.emit([
      ...this.seasons(),
      { seasonNumber: this.getNextSeasonNumber(this.seasons()), totalEpisodes: undefined },
    ]);
  }

  updateSeasonNumber(index: number, seasonNumber: string | number | null | undefined): void {
    const parsed = toPositiveNumber(seasonNumber, 1);
    const hasDuplicate = this.seasons().some((s, i) => i !== index && s.seasonNumber === parsed);
    if (hasDuplicate) return;
    this.patchSeason(index, { seasonNumber: parsed });
  }

  updateSeasonEpisodes(index: number, totalEpisodes: string | number | null | undefined): void {
    this.patchSeason(index, { totalEpisodes: toOptionalPositiveNumber(totalEpisodes) });
  }

  updateSeasonFirstAirDate(index: number, firstEpisodeAirDate: string | null | undefined): void {
    this.patchSeason(index, { firstEpisodeAirDate: toOptionalDateString(firstEpisodeAirDate) });
  }

  removeSeason(index: number): void {
    const newSeasons = this.seasons().filter((_, i) => i !== index);
    this.seasonsChange.emit(newSeasons);
  }

  private patchSeason(index: number, patch: Partial<SeasonInfo>): void {
    const seasons = [...this.seasons()];
    if (!seasons[index]) return;
    seasons[index] = { ...seasons[index], ...patch };
    this.seasonsChange.emit(seasons);
  }

  private getNextSeasonNumber(seasons: { seasonNumber: number }[]): number {
    if (seasons.length === 0) return 1;
    const max = Math.max(...seasons.map((s) => s.seasonNumber));
    return max + 1;
  }
}
