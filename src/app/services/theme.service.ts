import { Injectable, signal, effect, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { BrowserSettingsStorage } from './browser-settings-storage.service';

export type Theme = 'system' | 'light' | 'dark';

const THEMES: Theme[] = ['system', 'light', 'dark'];

@Injectable({
  providedIn: 'root',
})
export class ThemeService implements OnDestroy {
  private readonly STORAGE_KEY = 'theme';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly settingsStorage = inject(BrowserSettingsStorage);

  theme = signal<Theme>('system');

  private mediaQuery: MediaQueryList | null = null;
  private readonly mediaQueryListener = () => {
    if (this.theme() === 'system') {
      this.applyTheme();
    }
  };

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const raw = this.settingsStorage.read(this.STORAGE_KEY);
      const stored = THEMES.find((theme) => theme === raw);
      if (stored) {
        this.theme.set(stored);
      }

      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQuery.addEventListener('change', this.mediaQueryListener);
    }

    effect(() => {
      this.applyTheme();
    });
  }

  setTheme(newTheme: Theme): void {
    this.theme.set(newTheme);
    if (isPlatformBrowser(this.platformId)) {
      this.settingsStorage.write(this.STORAGE_KEY, newTheme);
    }
  }

  cycleTheme(): void {
    const nextIndex = (THEMES.indexOf(this.theme()) + 1) % THEMES.length;
    this.setTheme(THEMES[nextIndex]);
  }

  private applyTheme(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const currentTheme = this.theme();
    const isDark =
      currentTheme === 'dark' || (currentTheme === 'system' && this.mediaQuery?.matches);

    this.document.documentElement.classList.toggle('dark', isDark);
  }

  ngOnDestroy(): void {
    this.mediaQuery?.removeEventListener('change', this.mediaQueryListener);
  }
}
