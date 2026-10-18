import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Group } from '../../models/group.model';
import { createSuggestionProviders } from '../../services/suggestion-search.test-utils';
import { ImageStorageService } from '../../services/image-storage.service';
import { ItemFormComponent } from './item-form.component';
import { vi } from 'vitest';
import { createDefaultItemFormValue } from '../../domain/item-form';

describe('ItemFormComponent', () => {
  const groups: Group[] = [
    {
      id: 'ungrouped',
      name: 'Ungrouped',
      order: 0,
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...createSuggestionProviders().providers,
        {
          provide: ImageStorageService,
          useValue: {
            getUrl: vi.fn(() => Promise.resolve(null)),
            storeUrl: vi.fn(() => Promise.resolve('image-1')),
            storeFile: vi.fn(() => Promise.resolve('image-1')),
            delete: vi.fn(() => Promise.resolve()),
            version: signal(0).asReadonly(),
          },
        },
      ],
    });
  });

  it('applies the selected status color on first render', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('initialValue', {
      title: 'Completed Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'completed',
      isAdult: false,
      season: 1,
      episode: 8,
      seasons: [{ seasonNumber: 1, totalEpisodes: 10 }],
      startImmediately: false,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const completedButton = buttons.find((button) => button.textContent?.trim() === 'Completed');

    expect(completedButton).toBeDefined();
    expect(completedButton?.className).toContain('bg-status-completed-bg-light');
    expect(completedButton?.className).toContain('border-transparent');
  });

  it('disables submit when pristine if configured', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('disableSubmitWhenPristine', true);
    fixture.componentRef.setInput('initialValue', {
      title: 'Completed Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'completed',
      isAdult: false,
      season: 1,
      episode: 8,
      seasons: [{ seasonNumber: 1, totalEpisodes: 10 }],
      startImmediately: false,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it.each([
    ['#season', '1.5'],
    ['#episode', '1.5'],
    ['#seasonNumber0', '1.5'],
    ['#seasonEpisodes0', '1.5'],
    ['#season', '0.5'],
    ['#episode', '0.5'],
    ['#seasonNumber0', '0.5'],
    ['#seasonEpisodes0', '0.5'],
  ])(
    'blocks fractional input in %s (%s) with visible feedback and allows correction',
    async (selector, fractional) => {
      const fixture = TestBed.createComponent(ItemFormComponent);
      fixture.componentRef.setInput('groups', groups);
      fixture.componentRef.setInput('initialValue', {
        ...createDefaultItemFormValue(),
        title: 'A series',
        seasons: [{ seasonNumber: 1, totalEpisodes: 12 }],
      });
      const submitted = vi.fn();
      fixture.componentInstance.submitted.subscribe(submitted);
      fixture.detectChanges();
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const input = root.querySelector<HTMLInputElement>(selector)!;

      input.value = fractional;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.componentInstance.submit();

      expect(submitted).not.toHaveBeenCalled();
      expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
      expect(root.querySelector('[role="alert"]')?.textContent).toContain('positive whole numbers');
      expect(root.querySelector<HTMLInputElement>(selector)?.value).toBe(fractional);

      const currentInput = root.querySelector<HTMLInputElement>(selector)!;
      currentInput.value = '2';
      currentInput.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
      expect(root.querySelector('[role="alert"]')).toBeNull();
      root
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      expect(submitted).toHaveBeenCalledOnce();
    },
  );

  it.each([Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])(
    'blocks unsafe numeric form values %s even when supplied as an initial value',
    async (episode) => {
      const fixture = TestBed.createComponent(ItemFormComponent);
      fixture.componentRef.setInput('groups', groups);
      fixture.componentRef.setInput('initialValue', {
        ...createDefaultItemFormValue(),
        title: 'A series',
        episode,
      });
      const submitted = vi.fn();
      fixture.componentInstance.submitted.subscribe(submitted);
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentInstance.submit();

      expect(submitted).not.toHaveBeenCalled();
      expect(fixture.componentInstance.isSubmitDisabled()).toBe(true);
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent,
      ).toContain('positive whole numbers');
    },
  );

  it('shows the duplicate title hint when provided', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput(
      'duplicateTitleHint',
      'An item named "Existing Show" already exists.',
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'An item named "Existing Show" already exists.',
    );
  });

  it('does not show a duplicate title hint by default', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('already exists');
  });

  it('renders TMDB suggestions and applies the selected title and type', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('suggestions', [
      {
        id: 11,
        source: 'tmdb',
        title: 'Star Wars',
        type: 'movie',
        isAdult: true,
        year: '1977',
        overview: 'A space opera.',
      },
    ]);
    const selected: unknown[] = [];
    fixture.componentInstance.suggestionSelected.subscribe((suggestion) =>
      selected.push(suggestion),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const suggestionButton = buttons.find((button) => button.textContent?.includes('Star Wars'));

    expect(suggestionButton).toBeDefined();
    suggestionButton?.click();

    expect(fixture.componentInstance.formValue().title).toBe('Star Wars');
    expect(fixture.componentInstance.formValue().type).toBe('movie');
    expect(fixture.componentInstance.formValue().isAdult).toBe(true);
    expect(selected).toEqual([
      {
        id: 11,
        source: 'tmdb',
        title: 'Star Wars',
        type: 'movie',
        isAdult: true,
        year: '1977',
        overview: 'A space opera.',
      },
    ]);
  });

  it('updates seasons via updateSeasons', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('initialValue', {
      title: 'Weekly Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'in-progress',
      isAdult: false,
      season: 1,
      episode: 1,
      seasons: [{ seasonNumber: 1, totalEpisodes: 10 }],
      startImmediately: false,
    });

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.updateSeasons([
      { seasonNumber: 1, totalEpisodes: 10, firstEpisodeAirDate: '2026-05-01' },
    ]);

    expect(fixture.componentInstance.formValue().seasons[0].firstEpisodeAirDate).toBe('2026-05-01');
  });

  it('allows a movie to remain paused', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('initialValue', {
      title: 'Paused Movie',
      type: 'series',
      groupId: 'ungrouped',
      status: 'paused',
      isAdult: false,
      season: 2,
      episode: 3,
      seasons: [{ seasonNumber: 2, totalEpisodes: 10 }],
      startImmediately: false,
    });

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.setType('movie');
    await fixture.whenStable();

    expect(fixture.componentInstance.formValue()).toMatchObject({
      title: 'Paused Movie',
      type: 'movie',
      status: 'paused',
      isAdult: false,
    });
    expect(fixture.componentInstance.itemStatuses).toContain('paused');
  });

  it('applies an autofill patch once when the patch id changes', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('initialValue', {
      title: 'Weekly Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'not-started',
      isAdult: false,
      season: 1,
      episode: 1,
      seasons: [],
      startImmediately: false,
    });

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('autofillPatch', {
      id: 1,
      value: {
        seasons: [
          {
            seasonNumber: 1,
            totalEpisodes: 10,
            firstEpisodeAirDate: '2026-05-01',
          },
        ],
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.formValue().seasons).toEqual([
      {
        seasonNumber: 1,
        totalEpisodes: 10,
        firstEpisodeAirDate: '2026-05-01',
      },
    ]);
  });
});
