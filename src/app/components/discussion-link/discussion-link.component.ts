import { Component, computed, inject, input } from '@angular/core';
import { ItemType, WatchHistoryEntry } from '../../models/item.model';
import { DiscussionSettingsService } from '../../services/discussion-settings.service';
import { buildDiscussionUrl } from '../../utils/discussion-link.utils';

@Component({
  selector: 'app-discussion-link',
  template: `
    @if (url(); as href) {
      <a
        [href]="href"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-accent-primary hover:underline"
        [attr.aria-label]="'Find discussion for ' + title() + ' (opens in a new tab)'"
        >Find discussion</a
      >
    }
  `,
})
export class DiscussionLinkComponent {
  readonly title = input.required<string>();
  readonly type = input.required<ItemType>();
  readonly entry = input.required<WatchHistoryEntry>();
  private readonly settings = inject(DiscussionSettingsService);
  readonly url = computed(() => {
    const settings = this.settings.settings();
    return settings.enabled
      ? buildDiscussionUrl(settings.urlTemplate, {
          ...(this.type() === 'movie' ? {} : this.entry()),
          title: this.title(),
        })
      : null;
  });
}
