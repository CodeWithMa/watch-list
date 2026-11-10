import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { createDefaultStorageData } from '../domain/storage-schema';
import { StorageService } from '../services/storage.service';
import { WatchListService } from '../services/watch-list.service';
import { DiscussionSettingsService } from '../services/discussion-settings.service';
import { holdStorageWrite } from '../services/indexeddb-write.test-utils';
import { HomeComponent } from './home/home.component';
import { ItemViewComponent } from './item-view/item-view.component';
import { WatchHistoryComponent } from './watch-history/watch-history.component';
import { DiscussionLinkComponent } from './discussion-link/discussion-link.component';
import { ProviderSettingsService } from '../services/provider-settings.service';

describe('Discussion links across screens', () => {
  beforeEach(() => localStorage.removeItem('discussionLinks'));
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem('discussionLinks');
    localStorage.removeItem('suggestionProviders');
  });

  async function setup() {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'series' })) },
        },
      ],
    });
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    await storage.importData({
      ...createDefaultStorageData(),
      items: {
        series: {
          id: 'series',
          title: 'Dexter Resurrection',
          type: 'series',
          status: 'in-progress',
          groupId: 'ungrouped',
          createdAt: '2026-01-01',
          isAdult: false,
          watchHistory: [],
          progress: {
            season: 2,
            episode: 1,
            seasons: [
              { seasonNumber: 2, totalEpisodes: 1 },
              { seasonNumber: 3, totalEpisodes: 2 },
            ],
          },
        },
      },
    });
    return {
      storage,
      watch: TestBed.inject(WatchListService),
      settings: TestBed.inject(DiscussionSettingsService),
    };
  }

  const screens = [
    { component: HomeComponent, name: 'Home' },
    { component: ItemViewComponent, name: 'Item view' },
    { component: WatchHistoryComponent, name: 'Watch history' },
  ];

  it.each(screens)(
    'uses committed history after season rollover on $name and hides links when disabled',
    async ({ component }) => {
      const { watch, settings } = await setup();
      settings.setEnabled(true);
      settings.saveTemplate('https://duckduckgo.com/?q={title}%20{episodeCode}');
      const fixture = TestBed.createComponent<
        HomeComponent | ItemViewComponent | WatchHistoryComponent
      >(component);
      fixture.detectChanges();
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const links = () => [...root.querySelectorAll<HTMLAnchorElement>('app-discussion-link a')];
      expect(links()).toHaveLength(0);
      const held = holdStorageWrite(0);
      const marking = watch.markWatched('series');
      try {
        await held.started;
        fixture.detectChanges();
        expect(links()).toHaveLength(0);
      } finally {
        held.release();
        await marking;
      }
      fixture.detectChanges();
      expect(watch.items()[0].progress).toMatchObject({ season: 3, episode: 1 });
      expect(links()).toHaveLength(1);
      expect(links()[0].href).toBe('https://duckduckgo.com/?q=Dexter%20Resurrection%20s02e01');
      expect(links()[0].target).toBe('_blank');
      expect(links()[0].rel).toBe('noopener noreferrer');
      settings.setEnabled(false);
      fixture.detectChanges();
      expect(links()).toHaveLength(0);
      if (component === HomeComponent) expect(root.textContent).not.toContain('Last watched:');
    },
  );

  it('does not expose hidden adult titles in the new Home shortcut', async () => {
    const { storage, settings, watch } = await setup();
    settings.setEnabled(true);
    await watch.markWatched('series');
    await storage.mutate((draft) => {
      draft.items['series'].isAdult = true;
    });
    TestBed.inject(ProviderSettingsService).setAdultDisplayMode('hide');
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.lastWatched()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Last watched:');
    expect(fixture.nativeElement.querySelector('app-discussion-link a')).toBeNull();
  });

  it('uses title-only searches for movies even if imported history contains episode fields', () => {
    const settings = TestBed.inject(DiscussionSettingsService);
    settings.setEnabled(true);
    const fixture = TestBed.createComponent(DiscussionLinkComponent);
    fixture.componentRef.setInput('title', 'Movie & More');
    fixture.componentRef.setInput('type', 'movie');
    fixture.componentRef.setInput('entry', { date: '2026-01-01', season: 1, episode: 1 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a').href).toBe(
      'https://www.google.com/search?q=reddit%20Movie%20%26%20More%20',
    );
  });

  it('renders deleted and incomplete history without inventing episode numbers', async () => {
    const { storage, settings, watch } = await setup();
    await storage.mutate((draft) => {
      draft.items['series'].watchHistory.push({ date: '2026-01-01', season: 2 });
    });
    await watch.deleteItem('series');
    const fixture = TestBed.createComponent(WatchHistoryComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-discussion-link a')).toBeNull();
    settings.setEnabled(true);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('(deleted)');
    expect(root.querySelector('app-discussion-link a')?.getAttribute('href')).toBe(
      'https://www.google.com/search?q=reddit%20Dexter%20Resurrection%20',
    );
  });
});
