import { Injectable, signal } from '@angular/core';
import { SuggestionSource } from '../models/suggestion.model';

const PROVIDER_SETTINGS_KEY = 'suggestionProviders';

export type TitleLanguage = 'romaji' | 'english' | 'native';
export type TitlePreference = TitleLanguage[];

const VALID_TITLE_LANGS: readonly TitleLanguage[] = ['romaji', 'english', 'native'] as const;

export const DEFAULT_TITLE_PREFERENCE: readonly TitleLanguage[] = Object.freeze([
  'romaji',
  'english',
  'native',
] as const);

export type AdultDisplayMode = 'show' | 'blur' | 'hide';

const VALID_ADULT_DISPLAY_MODES: readonly AdultDisplayMode[] = ['show', 'blur', 'hide'] as const;

const DEFAULT_ADULT_DISPLAY_MODE: AdultDisplayMode = 'blur';

const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  tmdb: true,
  jikan: true,
  anilist: true,
  includeAdult: false,
  titlePreference: [...DEFAULT_TITLE_PREFERENCE],
  adultDisplayMode: DEFAULT_ADULT_DISPLAY_MODE,
};

export type ProviderSettings = Record<SuggestionSource, boolean> & {
  includeAdult: boolean;
  titlePreference: TitlePreference;
  adultDisplayMode: AdultDisplayMode;
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

  isAdultIncluded(): boolean {
    return this.enabled().includeAdult;
  }

  getTitlePreference(): TitlePreference {
    const pref = this.enabled().titlePreference;
    return Array.isArray(pref) ? [...pref] : [...DEFAULT_TITLE_PREFERENCE];
  }

  setIncludeAdult(includeAdult: boolean): void {
    const next = { ...this.enabled(), includeAdult };
    this.enabled.set(next);
    this.save(next);
  }

  setTitlePreference(preference: TitlePreference): void {
    const normalized = this.normalizeTitlePreference(preference);
    const next = { ...this.enabled(), titlePreference: normalized };
    this.enabled.set(next);
    this.save(next);
  }

  getAdultDisplayMode(): AdultDisplayMode {
    return this.normalizeAdultDisplayMode(this.enabled().adultDisplayMode);
  }

  setAdultDisplayMode(mode: AdultDisplayMode): void {
    const normalized = this.normalizeAdultDisplayMode(mode);
    const next = { ...this.enabled(), adultDisplayMode: normalized };
    this.enabled.set(next);
    this.save(next);
  }

  private load(): ProviderSettings {
    try {
      const raw = localStorage.getItem(PROVIDER_SETTINGS_KEY);
      if (!raw) {
        return {
          ...DEFAULT_PROVIDER_SETTINGS,
          titlePreference: [...DEFAULT_TITLE_PREFERENCE],
        };
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        return {
          ...DEFAULT_PROVIDER_SETTINGS,
          titlePreference: [...DEFAULT_TITLE_PREFERENCE],
        };
      }
      const obj = parsed as Record<string, unknown>;
      return {
        tmdb: typeof obj['tmdb'] === 'boolean' ? obj['tmdb'] : DEFAULT_PROVIDER_SETTINGS.tmdb,
        jikan: typeof obj['jikan'] === 'boolean' ? obj['jikan'] : DEFAULT_PROVIDER_SETTINGS.jikan,
        anilist:
          typeof obj['anilist'] === 'boolean' ? obj['anilist'] : DEFAULT_PROVIDER_SETTINGS.anilist,
        includeAdult:
          typeof obj['includeAdult'] === 'boolean'
            ? obj['includeAdult']
            : DEFAULT_PROVIDER_SETTINGS.includeAdult,
        titlePreference: this.normalizeTitlePreference(obj['titlePreference']),
        adultDisplayMode: this.normalizeAdultDisplayMode(obj['adultDisplayMode']),
      };
    } catch {
      return {
        ...DEFAULT_PROVIDER_SETTINGS,
        titlePreference: [...DEFAULT_TITLE_PREFERENCE],
      };
    }
  }

  private normalizeAdultDisplayMode(value: unknown): AdultDisplayMode {
    if (
      typeof value === 'string' &&
      (VALID_ADULT_DISPLAY_MODES as readonly string[]).includes(value)
    ) {
      return value as AdultDisplayMode;
    }
    return DEFAULT_ADULT_DISPLAY_MODE;
  }

  // Strict reset: any invalid entry (wrong length, duplicate, unknown lang) falls back to default.
  // Alternative lenient dedup/filter was considered but we prefer explicit reset to avoid drift.
  private normalizeTitlePreference(value: unknown): TitlePreference {
    if (!Array.isArray(value) || value.length !== 3) {
      return [...DEFAULT_TITLE_PREFERENCE];
    }
    const seen = new Set<string>();
    const normalized: TitleLanguage[] = [];
    for (const entry of value) {
      if (typeof entry !== 'string') {
        return [...DEFAULT_TITLE_PREFERENCE];
      }
      const lang = entry as TitleLanguage;
      if (!VALID_TITLE_LANGS.includes(lang) || seen.has(lang)) {
        return [...DEFAULT_TITLE_PREFERENCE];
      }
      seen.add(lang);
      normalized.push(lang);
    }
    return normalized.length === 3 ? normalized : [...DEFAULT_TITLE_PREFERENCE];
  }

  private save(settings: ProviderSettings): void {
    try {
      localStorage.setItem(PROVIDER_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Retain in-memory state even if persistence fails (quota, private mode, etc.).
    }
  }
}
