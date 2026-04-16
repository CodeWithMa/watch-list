import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'system' | 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'theme';
  
  theme = signal<Theme>('system');
  
  private mediaQuery: MediaQueryList;
  private mediaQueryListener: (e: MediaQueryListEvent) => void;

  constructor() {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    this.mediaQueryListener = (e: MediaQueryListEvent) => {
      if (this.theme() === 'system') {
        this.applyTheme();
      }
    };
    
    this.mediaQuery.addEventListener('change', this.mediaQueryListener);
    
    effect(() => {
      this.applyTheme();
    });
  }

  init(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
    if (stored && ['system', 'light', 'dark'].includes(stored)) {
      this.theme.set(stored);
    } else {
      this.theme.set('system');
    }
  }

  setTheme(newTheme: Theme): void {
    this.theme.set(newTheme);
    localStorage.setItem(this.STORAGE_KEY, newTheme);
  }

  cycleTheme(): void {
    const current = this.theme();
    const order: Theme[] = ['system', 'light', 'dark'];
    const currentIndex = order.indexOf(current);
    const nextIndex = (currentIndex + 1) % order.length;
    this.setTheme(order[nextIndex]);
  }

  private applyTheme(): void {
    const currentTheme = this.theme();
    const isDark = currentTheme === 'dark' || 
      (currentTheme === 'system' && this.mediaQuery.matches);
    
    document.documentElement.classList.toggle('dark', isDark);
  }

  ngOnDestroy(): void {
    this.mediaQuery.removeEventListener('change', this.mediaQueryListener);
  }
}
