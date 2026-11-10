import { Component, computed, effect, inject, signal } from '@angular/core';
import { DiscussionSettingsService } from '../../services/discussion-settings.service';
import {
  buildDiscussionUrl,
  DEFAULT_DISCUSSION_URL_TEMPLATE,
  validateDiscussionTemplate,
} from '../../utils/discussion-link.utils';

@Component({
  selector: 'app-discussion-settings',
  template: `
    <section class="bg-light-bg-tertiary dark:bg-dark-bg-tertiary p-6 rounded-lg mb-6">
      <h2 class="text-xl mt-0 mb-4 text-light-font-secondary dark:text-dark-font-secondary">
        Discussion links
      </h2>
      <label class="flex items-center gap-3 cursor-pointer">
        <input
          #enabled
          id="discussionLinksEnabled"
          type="checkbox"
          [checked]="settings.settings().enabled"
          (change)="toggle(enabled.checked)"
          class="w-5 h-5"
        />
        <span>Enable discussion links</span>
      </label>
      <div class="mt-4">
        <label for="discussionUrlTemplate" class="block mb-2 font-medium">URL template</label>
        <input
          #urlInput
          id="discussionUrlTemplate"
          type="text"
          [value]="template()"
          (input)="template.set(urlInput.value); message.set(null)"
          [attr.aria-invalid]="error() ? 'true' : null"
          aria-describedby="discussionTemplateHelp discussionTemplateError"
          class="form-control"
        />
        <p id="discussionTemplateHelp" class="mt-2 text-sm">
          Use {{ '{title}, {season}, {episode}, or {episodeCode}' }} (for example, s02e01). Episode
          placeholders are empty for movies or missing history details. Placeholders can appear in
          the path, query, or fragment of an HTTP/HTTPS URL.
        </p>
        <p id="discussionTemplateError" class="text-sm text-accent-danger" aria-live="polite">
          {{ error() }}
        </p>
        @if (preview(); as url) {
          <p class="text-sm break-all">
            Example — Dexter Resurrection, S2E1:
            <a
              [href]="url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-accent-primary hover:underline"
              >{{ url }}</a
            >
          </p>
        }
        <div class="flex flex-wrap gap-3 mt-4">
          <button
            type="button"
            (click)="save()"
            [disabled]="!!error()"
            class="px-6 py-3 rounded cursor-pointer bg-accent-primary text-white hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save template
          </button>
          <button
            type="button"
            (click)="reset()"
            class="px-6 py-3 rounded cursor-pointer bg-accent-secondary text-white hover:bg-accent-secondary-hover"
          >
            Reset to default
          </button>
        </div>
        @if (message()) {
          <p role="status" class="mt-4 text-sm">{{ message() }}</p>
        }
      </div>
    </section>
  `,
})
export class DiscussionSettingsComponent {
  readonly settings = inject(DiscussionSettingsService);
  private readonly savedTemplate = computed(() => this.settings.settings().urlTemplate);
  readonly template = signal(this.savedTemplate());
  readonly error = computed(() => validateDiscussionTemplate(this.template().trim()));
  readonly preview = computed(() =>
    buildDiscussionUrl(this.template().trim(), {
      title: 'Dexter Resurrection',
      season: 2,
      episode: 1,
    }),
  );
  readonly message = signal<string | null>(null);

  constructor() {
    effect(() => this.template.set(this.savedTemplate()));
  }

  toggle(enabled: boolean) {
    this.showResult(this.settings.setEnabled(enabled));
  }

  save() {
    if (this.error()) return;
    this.showResult(this.settings.saveTemplate(this.template()));
    this.template.set(this.savedTemplate());
  }

  reset() {
    this.template.set(DEFAULT_DISCUSSION_URL_TEMPLATE);
    this.save();
  }

  private showResult(saved: boolean) {
    this.message.set(
      saved
        ? 'Discussion settings saved.'
        : 'Discussion settings apply to this session only; could not save to browser storage.',
    );
  }
}
