import { Injectable, signal } from '@angular/core';
import { SuggestionSource } from '../models/suggestion.model';

const PROVIDER_SETTINGS_KEY = 'suggestionProviders';

export type ProviderSettings = Record<SuggestionSource, boolean>;

const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  tmdb: true,
  jikan: true,
  anilist: true,
};

const PROVIDER_SOURCES: readonly SuggestionSource[] = ['tmdb', 'jikan', 'anilist'] as const;

@Injectable({
  providedIn: 'root',
})
export class ProviderSettingsService {
  private readonly enabled = signal<ProviderSettings>(this.load());

  readonly settings = this.enabled.asReadonly();

  isEnabled(source: SuggestionSource): boolean {
    return this.enabled()[source] ?? true;
  }

  isAnyEnabled(): boolean {
    const s = this.enabled();
    return s.tmdb || s.jikan || s.anilist;
  }

  getEnabledSources(): SuggestionSource[] {
    const s = this.enabled();
    return (PROVIDER_SOURCES as readonly SuggestionSource[]).filter((src) => s[src]);
  }

  setEnabled(source: SuggestionSource, enabled: boolean): void {
    const next = { ...this.enabled(), [source]: enabled };
    this.enabled.set(next);
    this.save(next);
  }

  private load(): ProviderSettings {
    try {
      const raw = localStorage.getItem(PROVIDER_SETTINGS_KEY);
      if (!raw) {
        return { ...DEFAULT_PROVIDER_SETTINGS };
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        return { ...DEFAULT_PROVIDER_SETTINGS };
      }
      const obj = parsed as Record<string, unknown>;
      return {
        tmdb: typeof obj['tmdb'] === 'boolean' ? obj['tmdb'] : DEFAULT_PROVIDER_SETTINGS.tmdb,
        jikan: typeof obj['jikan'] === 'boolean' ? obj['jikan'] : DEFAULT_PROVIDER_SETTINGS.jikan,
        anilist:
          typeof obj['anilist'] === 'boolean' ? obj['anilist'] : DEFAULT_PROVIDER_SETTINGS.anilist,
      };
    } catch {
      return { ...DEFAULT_PROVIDER_SETTINGS };
    }
  }

  private save(settings: ProviderSettings): void {
    localStorage.setItem(PROVIDER_SETTINGS_KEY, JSON.stringify(settings));
  }
}
