import { Injectable, inject, signal } from '@angular/core';
import { BrowserSettingsStorage } from './browser-settings-storage.service';

const TMDB_READ_TOKEN_KEY = 'tmdbReadAccessToken';
const TMDB_API_KEY = 'tmdbApiKey';

export type TmdbCredential =
  { type: 'read-token'; value: string } | { type: 'api-key'; value: string } | null;

@Injectable({
  providedIn: 'root',
})
export class TmdbSettingsService {
  private readonly settingsStorage = inject(BrowserSettingsStorage);
  private readonly readAccessToken = signal(this.loadToken());
  private readonly apiKey = signal(this.loadApiKey());

  readonly token = this.readAccessToken.asReadonly();
  readonly key = this.apiKey.asReadonly();

  saveCredentials(token: string, apiKey: string) {
    const normalizedToken = token.trim();
    const normalizedKey = apiKey.trim();
    const tokenSaved = this.settingsStorage.write(TMDB_READ_TOKEN_KEY, normalizedToken || null);
    const keySaved = this.settingsStorage.write(TMDB_API_KEY, normalizedKey || null);
    this.readAccessToken.set(normalizedToken);
    this.apiKey.set(normalizedKey);
    return tokenSaved && keySaved;
  }

  getCredential(): TmdbCredential {
    const token = this.readAccessToken();
    if (token) {
      return { type: 'read-token', value: token };
    }

    const apiKey = this.apiKey();
    if (apiKey) {
      return { type: 'api-key', value: apiKey };
    }

    return null;
  }

  clearCredentials() {
    return this.saveCredentials('', '');
  }

  private loadToken(): string {
    return this.settingsStorage.read(TMDB_READ_TOKEN_KEY)?.trim() ?? '';
  }

  private loadApiKey(): string {
    return this.settingsStorage.read(TMDB_API_KEY)?.trim() ?? '';
  }
}
