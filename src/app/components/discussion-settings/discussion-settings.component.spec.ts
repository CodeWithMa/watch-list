import { TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';
import { DiscussionSettingsComponent } from './discussion-settings.component';
import { DiscussionSettingsService } from '../../services/discussion-settings.service';
import { DEFAULT_DISCUSSION_URL_TEMPLATE } from '../../utils/discussion-link.utils';

describe('DiscussionSettingsComponent', () => {
  beforeEach(() => localStorage.removeItem('discussionLinks'));
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem('discussionLinks');
  });

  function setup() {
    const fixture = TestBed.createComponent(DiscussionSettingsComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('#discussionUrlTemplate')!;
    const checkbox = root.querySelector<HTMLInputElement>('#discussionLinksEnabled')!;
    const buttons = [...root.querySelectorAll('button')];
    function edit(value: string) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }
    return {
      fixture,
      root,
      input,
      checkbox,
      buttons,
      edit,
      settings: TestBed.inject(DiscussionSettingsService),
    };
  }

  it('offers an opt-in checkbox, placeholder help, and an encoded example preview', () => {
    const { root, input, checkbox } = setup();
    expect(checkbox.checked).toBe(false);
    expect(input.value).toBe(DEFAULT_DISCUSSION_URL_TEMPLATE);
    expect(root.textContent).toContain('{episodeCode}');
    expect(root.querySelector('a')?.getAttribute('href')).toBe(
      'https://www.google.com/search?q=reddit%20Dexter%20Resurrection%20s02e01',
    );
  });

  it('saves only on request, preserves drafts when toggled, and resets to Google', () => {
    const { fixture, input, checkbox, buttons, edit, settings } = setup();
    const custom = 'https://duckduckgo.com/?q={title}';
    edit(custom);
    expect(settings.settings().urlTemplate).toBe(DEFAULT_DISCUSSION_URL_TEMPLATE);
    checkbox.click();
    fixture.detectChanges();
    expect(settings.settings().enabled).toBe(true);
    expect(input.value).toBe(custom);
    buttons[0].click();
    fixture.detectChanges();
    expect(settings.settings().urlTemplate).toBe(custom);
    checkbox.click();
    expect(settings.settings()).toEqual({ enabled: false, urlTemplate: custom });
    buttons[1].click();
    fixture.detectChanges();
    expect(input.value).toBe(DEFAULT_DISCUSSION_URL_TEMPLATE);
    expect(settings.settings()).toEqual({
      enabled: false,
      urlTemplate: DEFAULT_DISCUSSION_URL_TEMPLATE,
    });
  });

  it('shows validation and prevents saving unsafe or unknown templates', () => {
    const { root, buttons, edit, settings, input } = setup();
    edit('javascript:alert(1)');
    expect(buttons[0].disabled).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('a')).toBeNull();
    expect(root.textContent).toContain('HTTP or HTTPS');
    edit('https://example.com/{unknown}');
    buttons[0].click();
    expect(settings.settings().urlTemplate).toBe(DEFAULT_DISCUSSION_URL_TEMPLATE);
  });

  it('updates the input and preview when preferences are imported', () => {
    const { fixture, input, settings } = setup();
    settings.importSettings({ enabled: true, urlTemplate: 'https://example.com/{title}' });
    fixture.detectChanges();
    expect(input.value).toBe('https://example.com/{title}');
  });

  it('explains when changes apply only to the session', () => {
    const { fixture, root, checkbox } = setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Unavailable');
    });
    checkbox.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('session only');
  });
});
