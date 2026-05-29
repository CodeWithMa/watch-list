import { Injectable, signal } from '@angular/core';

const TMDB_READ_TOKEN_KEY = 'tmdbReadAccessToken';

@Injectable({
  providedIn: 'root'
})
export class TmdbSettingsService {
  private readonly readAccessToken = signal(this.loadToken());

  readonly token = this.readAccessToken.asReadonly();

  saveToken(token: string): void {
    const normalized = token.trim();
    if (!normalized) {
      this.clearToken();
      return;
    }

    localStorage.setItem(TMDB_READ_TOKEN_KEY, normalized);
    this.readAccessToken.set(normalized);
  }

  clearToken(): void {
    localStorage.removeItem(TMDB_READ_TOKEN_KEY);
    this.readAccessToken.set('');
  }

  private loadToken(): string {
    return localStorage.getItem(TMDB_READ_TOKEN_KEY)?.trim() ?? '';
  }
}
