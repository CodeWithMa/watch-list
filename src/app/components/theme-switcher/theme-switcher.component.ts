import { Component, inject } from '@angular/core';
import { ThemeService, Theme } from '../../services/theme.service';

@Component({
  selector: 'app-theme-switcher',
  template: `
    <button 
      (click)="themeService.cycleTheme()"
      [attr.aria-label]="getAriaLabel()"
      class="p-2 rounded hover:bg-light-hover dark:hover:bg-dark-hover transition-colors duration-200"
      [title]="getTitle()"
    >
      @switch (themeService.theme()) {
        @case ('system') {
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-light-font dark:text-dark-font">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        }
        @case ('light') {
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-light-font dark:text-dark-font">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        }
        @case ('dark') {
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-light-font dark:text-dark-font">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        }
      }
    </button>
  `
})
export class ThemeSwitcherComponent {
  protected themeService = inject(ThemeService);

  getAriaLabel(): string {
    const current = this.themeService.theme();
    const next: Record<Theme, string> = {
      'system': 'Switch to Light mode',
      'light': 'Switch to Dark mode',
      'dark': 'Switch to System mode'
    };
    return next[current];
  }

  getTitle(): string {
    return this.getAriaLabel();
  }
}
