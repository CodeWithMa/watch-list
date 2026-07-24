import { TestBed } from '@angular/core/testing';
import { Group } from '../../models/group.model';
import { ItemFormComponent } from './item-form.component';

describe('ItemFormComponent', () => {
  const groups: Group[] = [
    {
      id: 'ungrouped',
      name: 'Ungrouped',
      order: 0,
    },
  ];

  it('applies the selected status color on first render', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('initialValue', {
      title: 'Completed Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'completed',
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
        tmdbId: 11,
        title: 'Star Wars',
        type: 'movie',
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
    expect(selected).toEqual([
      {
        tmdbId: 11,
        title: 'Star Wars',
        type: 'movie',
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

  it('applies an autofill patch once when the patch id changes', async () => {
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('initialValue', {
      title: 'Weekly Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'not-started',
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
