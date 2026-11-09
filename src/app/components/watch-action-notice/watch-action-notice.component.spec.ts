import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, vi } from 'vitest';
import { Item } from '../../models/item.model';
import { StorageService } from '../../services/storage.service';
import { WatchListService } from '../../services/watch-list.service';
import { HomeComponent } from '../home/home.component';
import { WatchActionNoticeComponent } from './watch-action-notice.component';
import { WatchActionNoticeService } from './watch-action-notice.service';

describe('Watch action acknowledgment and undo', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function setup(overrides: Partial<Item> = {}) {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    await storage.replaceData({
      ...storage.getData(),
      items: {
        series: {
          id: 'series',
          title: 'Severance',
          type: 'series',
          groupId: 'ungrouped',
          status: 'in-progress',
          isAdult: false,
          createdAt: '2026-01-01',
          watchHistory: [],
          progress: { season: 1, episode: 2, seasons: [] },
          ...overrides,
        },
      },
    });
    const home = TestBed.createComponent(HomeComponent);
    const notice = TestBed.createComponent(WatchActionNoticeComponent);
    home.detectChanges();
    notice.detectChanges();
    await home.whenStable();
    const homeRoot = home.nativeElement as HTMLElement;
    const noticeRoot = notice.nativeElement as HTMLElement;
    const homeButton = (label: string) =>
      [...homeRoot.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === label,
      )!;
    const undoButton = () =>
      [...noticeRoot.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Undo',
      );
    const settled = async (expected: string) => {
      await vi.waitFor(() => {
        notice.detectChanges();
        expect(noticeRoot.textContent).toContain(expected);
      });
      home.detectChanges();
    };
    return { storage, home, notice, noticeRoot, homeRoot, homeButton, undoButton, settled };
  }

  it('names the episode, logs exactly one record, and undo restores history and next episode', async () => {
    const { storage, homeButton, undoButton, settled, homeRoot } = await setup();
    const original = storage.getData().items['series'];

    homeButton('Mark S1 E2 watched').click();
    await settled('Severance: S1 E2 logged');
    const logged = storage.getData().items['series'];
    expect(logged.watchHistory).toHaveLength(1);
    expect(logged.watchHistory[0]).toMatchObject({ season: 1, episode: 2 });
    expect(logged.progress?.episode).toBe(3);
    expect(homeRoot.textContent).toContain('Mark S1 E3 watched');

    undoButton()!.click();
    await settled('Undone: Severance: S1 E2 logged');
    expect(storage.getData().items['series']).toEqual(original);
    expect(homeRoot.textContent).toContain('Mark S1 E2 watched');
    expect(undoButton()).toBeUndefined();

    const reloaded = TestBed.runInInjectionContext(() => new StorageService());
    await reloaded.initialize();
    expect(reloaded.getData().items['series']).toEqual(original);
  });

  it.each([
    ['Pause', 'Severance paused'],
    ['Drop', 'Severance dropped — watch history kept'],
  ])('acknowledges and undoes %s', async (label, message) => {
    const { storage, homeButton, undoButton, settled } = await setup();
    homeButton(label).click();
    await settled(message);
    undoButton()!.click();
    await settled('Undone:');
    expect(storage.getData().items['series'].status).toBe('in-progress');
  });

  it('undoes movie completion, returning it to the recommendation', async () => {
    const { storage, homeButton, undoButton, settled, homeRoot } = await setup({
      type: 'movie',
      progress: undefined,
    });
    homeButton('Mark watched').click();
    await settled('Severance marked as watched');
    expect(homeRoot.querySelector('article')).toBeNull();
    undoButton()!.click();
    await settled('Undone:');
    expect(homeRoot.querySelector('article')).not.toBeNull();
    expect(storage.getData().items['series'].watchHistory).toEqual([]);
    expect(storage.getData().items['series'].status).toBe('in-progress');
  });

  it('refuses to undo after the watch state changed elsewhere', async () => {
    const { storage, homeButton, undoButton, settled } = await setup();
    homeButton('Pause').click();
    await settled('Severance paused');
    await TestBed.inject(WatchListService).markDropped('series');
    undoButton()!.click();
    await settled('can no longer be undone');
    expect(storage.getData().items['series'].status).toBe('dropped');
  });

  it('reports a failed undo and leaves the change in place', async () => {
    const { storage, homeButton, undoButton, settled } = await setup();
    homeButton('Pause').click();
    await settled('Severance paused');
    vi.spyOn(TestBed.inject(WatchListService), 'revertWatchChange').mockRejectedValue(
      new Error('write failed'),
    );
    undoButton()!.click();
    await settled('Could not undo that action. Please try again.');
    expect(storage.getData().items['series'].status).toBe('paused');
  });

  it('expires after a while but stays while hovered or focused', async () => {
    const { noticeRoot, notice, homeButton, settled } = await setup();
    homeButton('Pause').click();
    await settled('Severance paused');

    vi.useFakeTimers();
    const notices = TestBed.inject(WatchActionNoticeService);
    notices.pause();
    vi.advanceTimersByTime(60_000);
    expect(notices.notice()).not.toBeNull();
    notices.resume();
    vi.advanceTimersByTime(10_000);
    expect(notices.notice()).toBeNull();
    notice.detectChanges();
    expect(noticeRoot.textContent).not.toContain('Severance paused');
  });

  it('can be dismissed', async () => {
    const { noticeRoot, notice, homeButton, settled } = await setup();
    homeButton('Pause').click();
    await settled('Severance paused');
    noticeRoot.querySelector<HTMLButtonElement>('button[aria-label="Dismiss message"]')!.click();
    notice.detectChanges();
    expect(noticeRoot.textContent).not.toContain('Severance paused');
  });
});
