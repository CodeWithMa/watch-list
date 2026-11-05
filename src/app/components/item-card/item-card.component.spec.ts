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
    isAdult: false,
    watchHistory: [{ date: '2026-04-02T10:00:00.000Z', season: 1, episode: 1 }],
    createdAt: '2026-04-01T10:00:00.000Z',
    progress: { season: 1, episode: 2, seasons: [{ seasonNumber: 1, totalEpisodes: 10 }] },
    ...overrides,
  };
}

describe('ItemCardComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ImageStorageService,
          useValue: {
            version: signal(0).asReadonly(),
            getUrl: vi.fn(() => Promise.resolve(null)),
          },
        },
      ],
    });
  });

  it('shows readable status, next episode, and a labelled timestamp', async () => {
    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentRef.setInput('item', createItem());
    fixture.detectChanges();
    await fixture.whenStable();
    const text = () => (fixture.nativeElement as HTMLElement).textContent;

    expect(text()).toContain('Test Show');
    expect(text()).toContain('In Progress');
    expect(text()).toContain('Next: S1 E2');
    expect(text()).toContain('Watched');
    expect(fixture.componentInstance.progressPercent()).toBe(10);
    expect(fixture.componentInstance.lastWatchedDate()).toBe('2026-04-02T10:00:00.000Z');

    fixture.componentRef.setInput('item', createItem({ status: 'not-started', watchHistory: [] }));
    fixture.detectChanges();
    expect(text()).toContain('Not Started');
    expect(text()).not.toContain('Next:');
    expect(text()).toContain('Added');

    fixture.componentRef.setInput('item', createItem({ status: 'completed' }));
    fixture.detectChanges();
    expect(text()).toContain('Completed');
    expect(text()).not.toContain('Next:');
    expect(fixture.componentInstance.progressPercent()).toBe(100);
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
