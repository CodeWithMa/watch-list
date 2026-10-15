import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SuggestionSource } from '../../models/suggestion.model';

@Component({
  selector: 'app-search-provider-select',
  imports: [FormsModule],
  host: { '[class.hidden]': 'sources().length < 2' },
  template: `
    @if (sources().length > 1) {
      <select
        [attr.aria-label]="label()"
        [ngModel]="value()"
        (ngModelChange)="valueChange.emit($event)"
        [ngModelOptions]="{ standalone: true }"
        class="form-control-sm"
      >
        @for (source of sources(); track source) {
          <option [value]="source">{{ labels[source] }}</option>
        }
      </select>
    }
  `,
})
export class SearchProviderSelectComponent {
  readonly sources = input.required<SuggestionSource[]>();
  readonly value = input.required<SuggestionSource | undefined>();
  readonly label = input.required<string>();
  readonly valueChange = output<SuggestionSource>();
  readonly labels = { tmdb: 'TMDB', jikan: 'Jikan', anilist: 'AniList' };
}
