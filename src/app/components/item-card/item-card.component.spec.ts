import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ItemCardComponent } from './item-card.component';
import { ImageStorageService } from '../../services/image-storage.service';
import { Item } from '../../models/item.model';

function createItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    title: 'Test Show',
    type: 'series',
    groupId: 'ungrouped',
    status: 'in-progress',
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
    fixture.componentRef.setInput('item', createItem({ status: 'completed' }));
    fixture.detectChanges();
    await fixture.whenStable();

    const instance = fixture.componentInstance;
    expect(instance.placeholderUrl()).toContain('data:image/svg+xml;base64,');
    expect(instance.statusColorClass()).toContain('bg-status-completed');
    expect(instance.progressPercent()).toBe(100);
    expect(instance.lastWatchedDate()).toBe('2026-04-02T10:00:00.000Z');
  });

  it('loads poster on init and on version change', async () => {
    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput('item', createItem({ posterId: 'p1' }));
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    // allow effect to run
    await new Promise((r) => setTimeout(r, 0));

    expect(getUrlMock).toHaveBeenCalledWith('p1');
    expect(fixture.componentInstance.posterUrl()).toBe('blob:p1');

    // change version should reload
    versionSignal.set(1);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    await Promise.resolve();

    expect(getUrlMock).toHaveBeenCalledTimes(2);
    expect(getUrlMock).toHaveBeenLastCalledWith('p1');
  });

  it('renders poster or placeholder based on posterUrl', async () => {
    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput('item', createItem({ posterId: 'p1' }));
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.posterUrl()).toBe('blob:p1');
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe('blob:p1');
  });

  it('does not set posterUrl if destroyed before load completes', async () => {
    let resolveUrl!: (v: string | null) => void;
    getUrlMock.mockImplementation(() => new Promise<string | null>((res) => (resolveUrl = res)));

    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput('item', createItem({ posterId: 'p1' }));
    fixture.detectChanges();

    fixture.destroy();
    resolveUrl('blob:p1');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(fixture.componentInstance.posterUrl()).toBeNull();
  });

  it('does not set posterUrl if item posterId changed before load completes', async () => {
    const resolvers = new Map<string, (v: string | null) => void>();
    getUrlMock.mockImplementation((id: string | undefined) => {
      return new Promise<string | null>((res) => {
        if (id) resolvers.set(id, res);
        else res(null);
      });
    });

    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput('item', createItem({ posterId: 'p1' }));
    fixture.detectChanges();

    // trigger second load with p2
    fixture.componentRef.setInput('item', createItem({ posterId: 'p2' }));
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));

    // resolve p1 first
    resolvers.get('p1')?.('blob:p1');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    // should still be null because p1 is stale
    expect(fixture.componentInstance.posterUrl()).toBeNull();

    // resolve p2
    resolvers.get('p2')?.('blob:p2');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(fixture.componentInstance.posterUrl()).toBe('blob:p2');
  });

  it('ignores stale version loads but allows fresh version load', async () => {
    const resolvers: ((v: string | null) => void)[] = [];
    getUrlMock.mockImplementation(() => new Promise<string | null>((res) => resolvers.push(res)));

    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput('item', createItem({ posterId: 'p1' }));
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));

    // version changes triggers second load
    versionSignal.set(99);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));

    expect(getUrlMock).toHaveBeenCalledTimes(2);
    // resolve first (stale)
    resolvers[0]('blob:p1');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(fixture.componentInstance.posterUrl()).toBeNull();

    // resolve second (fresh)
    resolvers[1]('blob:p1');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(fixture.componentInstance.posterUrl()).toBe('blob:p1');
  });

  it('shows placeholder when item has no posterId', async () => {
    getUrlMock.mockResolvedValue(null);
    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput('item', createItem({ posterId: undefined }));
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    expect(fixture.componentInstance.posterUrl()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Test Show');
  });

  it('computes progress and lastWatched for movie', () => {
    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput(
      'item',
      createItem({ type: 'movie', status: 'not-started', progress: undefined, watchHistory: [] }),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.progressPercent()).toBe(0);
    expect(fixture.componentInstance.lastWatchedDate()).toBe('2026-04-01T10:00:00.000Z');
  });
});
