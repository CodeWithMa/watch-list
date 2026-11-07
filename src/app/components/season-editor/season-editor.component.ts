import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div>
        @for (season of seasons(); track season.seasonNumber; let i = $index) {
          <div class="grid grid-cols-2 md:grid-cols-[1fr_1fr_1.5fr_auto] gap-2 mb-4 items-end">
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
            <div class="col-span-2 md:col-span-1">
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
            <button type="button" (click)="removeSeason(i)" class="btn btn-quiet">Remove</button>
          </div>
        }
        <button type="button" (click)="addSeason()" class="btn btn-secondary">Add season</button>
      </div>
    </div>
  `,
})
export class SeasonEditorComponent {
  readonly seasons = input.required<SeasonInfo[]>();
  readonly seasonsChange = output<SeasonInfo[]>();

  addSeason(): void {
    const nextSeasonNumber = this.getNextSeasonNumber(this.seasons());
    const newSeasons = [
      ...this.seasons(),
      { seasonNumber: nextSeasonNumber, totalEpisodes: undefined as number | undefined },
    ];
    this.seasonsChange.emit(newSeasons);
  }

  updateSeasonNumber(index: number, seasonNumber: string | number | null | undefined): void {
    const parsed = toPositiveNumber(seasonNumber, 1);
    const newSeasons = [...this.seasons()];
    if (newSeasons[index]) {
      const hasDuplicate = newSeasons.some((s, i) => i !== index && s.seasonNumber === parsed);
      if (!hasDuplicate) {
        newSeasons[index] = { ...newSeasons[index], seasonNumber: parsed };
        this.seasonsChange.emit(newSeasons);
      }
    }
  }

  updateSeasonEpisodes(index: number, totalEpisodes: string | number | null | undefined): void {
    const parsed = toOptionalPositiveNumber(totalEpisodes);
    const newSeasons = [...this.seasons()];
    if (newSeasons[index]) {
      newSeasons[index] = { ...newSeasons[index], totalEpisodes: parsed };
      this.seasonsChange.emit(newSeasons);
    }
  }

  updateSeasonFirstAirDate(index: number, firstEpisodeAirDate: string | null | undefined): void {
    const normalized = toOptionalDateString(firstEpisodeAirDate);
    const newSeasons = [...this.seasons()];
    if (newSeasons[index]) {
      newSeasons[index] = {
        ...newSeasons[index],
        firstEpisodeAirDate: normalized,
      };
      this.seasonsChange.emit(newSeasons);
    }
  }

  removeSeason(index: number): void {
    const newSeasons = this.seasons().filter((_, i) => i !== index);
    this.seasonsChange.emit(newSeasons);
  }

  private getNextSeasonNumber(seasons: { seasonNumber: number }[]): number {
    if (seasons.length === 0) return 1;
    const max = Math.max(...seasons.map((s) => s.seasonNumber));
    return max + 1;
  }
}
