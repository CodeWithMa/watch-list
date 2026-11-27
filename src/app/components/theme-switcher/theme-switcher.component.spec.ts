import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ThemeSwitcherComponent } from './theme-switcher.component';
import { BrowserSettingsStorage } from '../../services/browser-settings-storage.service';

class FakeColorSchemeQuery extends EventTarget implements MediaQueryList {
  readonly media = '(prefers-color-scheme: dark)';
  onchange = null;

  constructor(public matches: boolean) {
    super();
  }

  addListener(listener: () => void) {
    this.addEventListener('change', listener);
  }

  removeListener(listener: () => void) {
    this.removeEventListener('change', listener);
  }
}

function fakeOsColorScheme(prefersDark: boolean) {
  const query = new FakeColorSchemeQuery(prefersDark);
  vi.stubGlobal('matchMedia', () => query);
  return {
    change(dark: boolean) {
      query.matches = dark;
      query.dispatchEvent(new Event('change'));
    },
  };
}

function render(stored: string | null = null) {
  const settings = new Map<string, string | null>([['theme', stored]]);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: BrowserSettingsStorage,
        useValue: {
          read: (key: string) => settings.get(key) ?? null,
          write: (key: string, value: string | null) => settings.set(key, value),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ThemeSwitcherComponent);
  fixture.detectChanges();
  const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
  return {
    settings,
    label: () => button.getAttribute('aria-label'),
    click() {
      button.click();
      fixture.detectChanges();
    },
  };
}

const isDark = () => document.documentElement.classList.contains('dark');

describe('ThemeSwitcherComponent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove('dark');
  });

  it('cycles system → light → dark → system and saves each choice', () => {
    fakeOsColorScheme(true);
    const view = render();

    expect(view.label()).toBe('Switch to Light mode');
    expect(isDark()).toBe(true);

    view.click();
    expect(view.label()).toBe('Switch to Dark mode');
    expect(isDark()).toBe(false);
    expect(view.settings.get('theme')).toBe('light');

    view.click();
    expect(view.label()).toBe('Switch to System mode');
    expect(isDark()).toBe(true);
    expect(view.settings.get('theme')).toBe('dark');

    view.click();
    expect(view.label()).toBe('Switch to Light mode');
    expect(view.settings.get('theme')).toBe('system');
  });

  it('follows OS color scheme changes in system mode', () => {
    const os = fakeOsColorScheme(false);
    render();
    expect(isDark()).toBe(false);

    os.change(true);
    expect(isDark()).toBe(true);
  });

  it('ignores OS color scheme changes after an explicit choice', () => {
    const os = fakeOsColorScheme(false);
    render('light');

    os.change(true);
    expect(isDark()).toBe(false);
  });

  it('falls back to system mode for an unknown stored theme', () => {
    fakeOsColorScheme(false);
    const view = render('sepia');

    expect(view.label()).toBe('Switch to Light mode');
  });
});
