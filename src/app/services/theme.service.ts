import { Injectable, signal, effect, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { BrowserSettingsStorage } from './browser-settings-storage.service';

export type Theme = 'system' | 'light' | 'dark';

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
  private mediaQueryListener!: (e: MediaQueryListEvent) => void;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = this.settingsStorage.read(this.STORAGE_KEY) as Theme | null;
      if (stored && ['system', 'light', 'dark'].includes(stored)) {
        this.theme.set(stored);
      }

      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      this.mediaQueryListener = () => {
        if (this.theme() === 'system') {
          this.applyTheme();
        }
      };

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
    const current = this.theme();
    const order: Theme[] = ['system', 'light', 'dark'];
    const currentIndex = order.indexOf(current);
    const nextIndex = (currentIndex + 1) % order.length;
    this.setTheme(order[nextIndex]);
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
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener('change', this.mediaQueryListener);
    }
  }
}
