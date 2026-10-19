import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ItemCardComponent } from './item-card.component';
import { ImageStorageService } from '../../services/image-storage.service';
import { Item } from '../../models/item.model';
import { ProviderSettingsService } from '../../services/provider-settings.service';

function createItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    title: 'Test Show',
    type: 'series',
    groupId: 'ungrouped',
    status: 'in-progress',
    isAdult: false,
    watchHistory: [{ date: '2026-04-02T10:00:00.000Z', season: 1, episode: 1 }],
    createdAt: '2026-04-01T10:00:00.000Z',
    progress: { season: 1, episode: 2, seasons: [{ seasonNumber: 1, totalEpisodes: 10 }] },
    ...overrides,
  };
}

describe('ItemCardComponent', () => {
  let versionSignal: ReturnType<typeof signal<number>>;
  let getUrlMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    versionSignal = signal(0);
    getUrlMock = vi.fn((id: string | undefined) => Promise.resolve(id ? `blob:${id}` : null));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ImageStorageService,
          useValue: {
            version: versionSignal.asReadonly(),
            getUrl: getUrlMock,
          },
        },
      ],
    });
  });

  it('computes placeholder, status color, progress and last watched date', async () => {
    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput('item', createItem({ status: 'completed', isAdult: false }));
    fixture.detectChanges();
    await fixture.whenStable();

    const instance = fixture.componentInstance;
    expect(instance.placeholderUrl()).toContain('data:image/svg+xml;base64,');
    expect(instance.statusColorClass()).toContain('bg-status-completed');
    expect(instance.progressPercent()).toBe(100);
    expect(instance.lastWatchedDate()).toBe('2026-04-02T10:00:00.000Z');
  });

  it('renders the selected poster, retains it while loading, and falls back for a missing poster', async () => {
    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput('item', createItem({ posterId: 'p1' }));
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.posterUrl()).toBe('blob:p1'));
    fixture.detectChanges();

    expect(fixture.componentInstance.posterUrl()).toBe('blob:p1');
    expect(getUrlMock).toHaveBeenCalledWith('p1');
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe('blob:p1');

    let finish!: (url: string | null) => void;
    getUrlMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    fixture.componentRef.setInput('item', createItem({ posterId: 'missing' }));
    fixture.detectChanges();
    expect(getUrlMock).toHaveBeenLastCalledWith('missing');
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe('blob:p1');
    finish(null);
    await vi.waitFor(() => expect(fixture.componentInstance.posterUrl()).toBeNull());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe(
      fixture.componentInstance.placeholderUrl(),
    );
  });

  it('keeps adult posters blurred until revealed and resets reveal for another item', async () => {
    TestBed.inject(ProviderSettingsService).setAdultDisplayMode('blur');
    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput('item', createItem({ posterId: 'adult', isAdult: true }));
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.posterUrl()).toBe('blob:adult'));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('img')?.style.filter).toBe('blur(12px)');
    root.querySelector<HTMLButtonElement>('button[aria-label="Reveal adult poster"]')!.click();
    fixture.detectChanges();
    expect(root.querySelector('img')?.style.filter).toBe('');

    fixture.componentRef.setInput(
      'item',
      createItem({ id: 'another', posterId: 'adult', isAdult: true }),
    );
    fixture.detectChanges();
    expect(root.querySelector('img')?.style.filter).toBe('blur(12px)');
  });

  it('shows placeholder when item has no posterId', async () => {
    getUrlMock.mockResolvedValue(null);
    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput('item', createItem({ posterId: undefined }));
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    expect(fixture.componentInstance.posterUrl()).toBeNull();
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe(
      fixture.componentInstance.placeholderUrl(),
    );
    expect(fixture.nativeElement.textContent).toContain('Test Show');
  });

  it('computes progress and lastWatched for movie', () => {
    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput(
      'item',
      createItem({
        type: 'movie',
        status: 'not-started',
        isAdult: false,
        progress: undefined,
        watchHistory: [],
      }),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.progressPercent()).toBe(0);
    expect(fixture.componentInstance.lastWatchedDate()).toBe('2026-04-01T10:00:00.000Z');
  });
});
