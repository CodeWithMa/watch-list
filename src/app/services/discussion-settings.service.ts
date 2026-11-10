import { Injectable, inject, signal } from '@angular/core';
import { BrowserSettingsStorage } from './browser-settings-storage.service';
import {
  DEFAULT_DISCUSSION_URL_TEMPLATE,
  validateDiscussionTemplate,
} from '../utils/discussion-link.utils';

const STORAGE_KEY = 'discussionLinks';
const DEFAULT_SETTINGS = { enabled: false, urlTemplate: DEFAULT_DISCUSSION_URL_TEMPLATE };

export type DiscussionSettings = typeof DEFAULT_SETTINGS;

@Injectable({ providedIn: 'root' })
export class DiscussionSettingsService {
  private readonly storage = inject(BrowserSettingsStorage);
  private readonly state = signal(this.load());
  readonly settings = this.state.asReadonly();

  setEnabled(enabled: boolean) {
    return this.save({ ...this.state(), enabled });
  }

  saveTemplate(urlTemplate: string) {
    const trimmed = urlTemplate.trim();
    if (validateDiscussionTemplate(trimmed)) return false;
    return this.save({ ...this.state(), urlTemplate: trimmed });
  }

  exportSettings() {
    return { ...this.state() };
  }

  importSettings(raw: unknown) {
    const settings = parseSettings(raw);
    if (settings) this.save(settings);
  }

  private load(): DiscussionSettings {
    try {
      const raw = this.storage.read(STORAGE_KEY);
      return (raw && parseSettings(JSON.parse(raw))) || { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private save(settings: DiscussionSettings) {
    this.state.set(settings);
    return this.storage.write(STORAGE_KEY, JSON.stringify(settings));
  }
}

function parseSettings(raw: unknown): DiscussionSettings | null {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('enabled' in raw) ||
    typeof raw.enabled !== 'boolean' ||
    !('urlTemplate' in raw) ||
    typeof raw.urlTemplate !== 'string' ||
    validateDiscussionTemplate(raw.urlTemplate.trim())
  ) {
    return null;
  }
  return { enabled: raw.enabled, urlTemplate: raw.urlTemplate.trim() };
}
