import { Injectable, signal } from '@angular/core';

const TMDB_READ_TOKEN_KEY = 'tmdbReadAccessToken';
const TMDB_API_KEY = 'tmdbApiKey';

export type TmdbCredential =
  { type: 'read-token'; value: string } | { type: 'api-key'; value: string } | null;

@Injectable({
  providedIn: 'root',
})
export class TmdbSettingsService {
  private readonly readAccessToken = signal(this.loadToken());
  private readonly apiKey = signal(this.loadApiKey());

  readonly token = this.readAccessToken.asReadonly();
  readonly key = this.apiKey.asReadonly();

  saveCredentials(token: string, apiKey: string): void {
    this.saveReadToken(token);
    this.saveApiKey(apiKey);
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

  clearCredentials(): void {
    this.clearToken();
    localStorage.removeItem(TMDB_API_KEY);
    this.apiKey.set('');
  }

  private loadToken(): string {
    return localStorage.getItem(TMDB_READ_TOKEN_KEY)?.trim() ?? '';
  }

  private loadApiKey(): string {
    return localStorage.getItem(TMDB_API_KEY)?.trim() ?? '';
  }

  private saveReadToken(token: string): void {
    const normalized = token.trim();
    if (!normalized) {
      this.clearToken();
      return;
    }

    localStorage.setItem(TMDB_READ_TOKEN_KEY, normalized);
    this.readAccessToken.set(normalized);
  }

  private saveApiKey(apiKey: string): void {
    const normalized = apiKey.trim();
    if (!normalized) {
      localStorage.removeItem(TMDB_API_KEY);
      this.apiKey.set('');
      return;
    }

    localStorage.setItem(TMDB_API_KEY, normalized);
    this.apiKey.set(normalized);
  }

  private clearToken(): void {
    localStorage.removeItem(TMDB_READ_TOKEN_KEY);
    this.readAccessToken.set('');
  }
}
