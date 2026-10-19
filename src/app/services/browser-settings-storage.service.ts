import { Injectable, signal } from '@angular/core';

/** Optional browser settings never gate access to the collection. */
@Injectable({ providedIn: 'root' })
export class BrowserSettingsStorage {
  private readonly failed = signal(false);
  readonly unavailable = this.failed.asReadonly();

  read(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      this.failed.set(true);
      return null;
    }
  }

  write(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      return true;
    } catch {
      this.failed.set(true);
      return false;
    }
  }
}
