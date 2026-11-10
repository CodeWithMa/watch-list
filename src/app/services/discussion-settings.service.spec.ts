import { TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';
import { DiscussionSettingsService } from './discussion-settings.service';
import { BrowserSettingsStorage } from './browser-settings-storage.service';
import { DEFAULT_DISCUSSION_URL_TEMPLATE } from '../utils/discussion-link.utils';

describe('DiscussionSettingsService', () => {
  beforeEach(() => localStorage.removeItem('discussionLinks'));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.removeItem('discussionLinks');
  });

  const reload = () => TestBed.runInInjectionContext(() => new DiscussionSettingsService());

  it('defaults to disabled with a Google template', () => {
    expect(TestBed.inject(DiscussionSettingsService).settings()).toEqual({
      enabled: false,
      urlTemplate: DEFAULT_DISCUSSION_URL_TEMPLATE,
    });
  });

  it('persists settings and preserves the template when disabled', () => {
    const settings = TestBed.inject(DiscussionSettingsService);
    settings.saveTemplate('  https://duckduckgo.com/?q={title}  ');
    settings.setEnabled(true);
    expect(reload().settings()).toEqual({
      enabled: true,
      urlTemplate: 'https://duckduckgo.com/?q={title}',
    });
    settings.setEnabled(false);
    expect(reload().settings()).toEqual({
      enabled: false,
      urlTemplate: 'https://duckduckgo.com/?q={title}',
    });
  });

  it.each([
    'invalid JSON',
    'null',
    '[]',
    '{}',
    '{"enabled":true,"urlTemplate":"javascript:alert(1)"}',
  ])('falls back safely for corrupt stored preferences: %s', (raw) => {
    localStorage.setItem('discussionLinks', raw);
    expect(reload().settings()).toEqual({
      enabled: false,
      urlTemplate: DEFAULT_DISCUSSION_URL_TEMPLATE,
    });
  });

  it('ignores missing or invalid imported preferences and unknown properties', () => {
    const settings = TestBed.inject(DiscussionSettingsService);
    settings.setEnabled(true);
    for (const raw of [undefined, null, [], {}, { enabled: true, urlTemplate: 'file:///bad' }]) {
      settings.importSettings(raw);
      expect(settings.settings().enabled).toBe(true);
    }
    settings.importSettings({
      enabled: false,
      urlTemplate: 'https://example.com/{title}',
      secret: 'ignored',
    });
    expect(settings.exportSettings()).toEqual({
      enabled: false,
      urlTemplate: 'https://example.com/{title}',
    });
  });

  it('does not save an invalid template', () => {
    const settings = TestBed.inject(DiscussionSettingsService);
    expect(settings.saveTemplate('javascript:alert(1)')).toBe(false);
    expect(settings.settings().urlTemplate).toBe(DEFAULT_DISCUSSION_URL_TEMPLATE);
  });

  it('keeps settings usable for the session when writes fail', () => {
    const settings = TestBed.inject(DiscussionSettingsService);
    vi.stubGlobal('localStorage', {
      setItem() {
        throw new Error('Unavailable');
      },
    });
    expect(settings.setEnabled(true)).toBe(false);
    expect(settings.saveTemplate('https://example.com/{title}')).toBe(false);
    expect(settings.settings()).toEqual({
      enabled: true,
      urlTemplate: 'https://example.com/{title}',
    });
    expect(TestBed.inject(BrowserSettingsStorage).unavailable()).toBe(true);
  });

  it('defaults safely when reads fail', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('Unavailable');
      },
    });
    expect(reload().settings().enabled).toBe(false);
    expect(TestBed.inject(BrowserSettingsStorage).unavailable()).toBe(true);
  });
});
