import { Injectable, inject, computed } from '@angular/core';
import { StorageService } from './storage.service';
import { Item, ItemStatus, SeriesProgress } from '../models/item.model';
import { HistoryEntry } from '../models/storage.model';
import { ImageStorageService } from './image-storage.service';
import { isEpisodicType } from '../domain/item.constants';
import {
  canSnoozeCurrentSeason,
  getCurrentSeason,
  isValidSnoozeCount,
} from '../domain/episode-release';

function advanceSeriesProgress(progress: SeriesProgress): {
  progress: SeriesProgress;
  completed: boolean;
} {
  const currentSeasonInfo = progress.seasons.find((s) => s.seasonNumber === progress.season);
  const currentTotal = currentSeasonInfo?.totalEpisodes;

  if (currentTotal !== undefined && currentTotal > 0 && progress.episode >= currentTotal) {
    const sorted = [...progress.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
    const next = sorted.find((s) => s.seasonNumber > progress.season);
    if (next) {
      return { progress: { ...progress, season: next.seasonNumber, episode: 1 }, completed: false };
    }
    return { progress, completed: true };
  }

  return { progress: { ...progress, episode: progress.episode + 1 }, completed: false };
}

@Injectable({
  providedIn: 'root',
})
export class WatchListService {
  private storageService = inject(StorageService);
  private imageStorage = inject(ImageStorageService);

  async addItem(item: Omit<Item, 'id' | 'createdAt' | 'watchHistory'>): Promise<void> {
    const data = this.storageService.getData();
    const id = this.generateId();
    const now = new Date().toISOString();

    const newItem: Item = {
      ...item,
      id,
      createdAt: now,
      watchHistory: [],
    };

    await this.storageService.saveItemChanges({
      deletedItems: data.deletedItems,
      items: {
        ...data.items,
        [id]: newItem,
      },
    });
  }

  async updateItem(item: Item): Promise<void> {
    const data = this.storageService.getData();
    const previousPosterId = data.items[item.id]?.posterId;
    await this.storageService.saveItemChanges({
      deletedItems: data.deletedItems,
      items: {
        ...data.items,
        [item.id]: item,
      },
    });
    if (previousPosterId && previousPosterId !== item.posterId) {
      await this.imageStorage.delete(previousPosterId);
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    const data = this.storageService.getData();
    const { [itemId]: removed, ...items } = data.items;

    if (!removed) {
      return;
    }

    const deletedItems = {
      ...(data.deletedItems || {}),
      [itemId]: {
        itemId,
        itemTitle: removed.title,
        itemType: removed.type,
        watchHistory: removed.watchHistory || [],
        deletedAt: new Date().toISOString(),
      },
    };

    await this.storageService.saveItemChanges({
      items,
      deletedItems,
    });
    await this.imageStorage.delete(removed.posterId);
  }

  markWatched(itemId: string) {
    return this.mutateItem(itemId, (item) => {
      const now = new Date().toISOString();
      if (!isEpisodicType(item.type)) {
        item.status = 'completed';
        item.watchHistory.push({ date: now });
        return;
      }

      const progress = item.progress || { season: 1, episode: 1, seasons: [] };
      const { progress: newProgress, completed } = advanceSeriesProgress(progress);
      item.status = completed ? 'completed' : 'in-progress';
      item.progress = newProgress;
      item.watchHistory.push({ date: now, season: progress.season, episode: progress.episode });
    });
  }

  snoozeOneWeek(itemId: string) {
    return this.changeReleaseDelay(itemId, 1);
  }

  removeOneWeekDelay(itemId: string) {
    return this.changeReleaseDelay(itemId, -1);
  }

  private changeReleaseDelay(itemId: string, change: 1 | -1) {
    return this.mutateItem(itemId, (item) => {
      if (item.status !== 'in-progress' || !item.progress) return;
      const season = getCurrentSeason(item);
      if (!season) return;
      const count = season.snoozeCount ?? 0;
      if (!isValidSnoozeCount(count)) return;
      if (change === 1 ? !canSnoozeCurrentSeason(item) : count === 0) return;

      season.snoozeCount = count + change;
    });
  }

  markCompleted(itemId: string) {
    return this.changeStatus(itemId, 'completed');
  }

  markDropped(itemId: string) {
    return this.changeStatus(itemId, 'dropped');
  }

  markStarted(itemId: string) {
    return this.changeStatus(itemId, 'in-progress');
  }

  markPaused(itemId: string) {
    return this.changeStatus(itemId, 'paused');
  }

  private changeStatus(itemId: string, status: ItemStatus) {
    return this.mutateItem(itemId, (item) => {
      item.status = status;
    });
  }

  private mutateItem(itemId: string, intent: (item: Item) => void) {
    return this.storageService.mutate((draft) => {
      if (Object.hasOwn(draft.items, itemId)) intent(draft.items[itemId]);
    });
  }

  getItemById(itemId: string): Item | undefined {
    const data = this.storageService.getData();
    return data.items[itemId];
  }

  getAllWatchHistory(): HistoryEntry[] {
    return this.history();
  }

  private generateId(): string {
    return `item-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  items = computed(() => {
    const data = this.storageService.getDataSignal()();
    return data ? Object.values(data.items) : [];
  });

  inProgressSeries = computed(() =>
    this.items().filter((i) => isEpisodicType(i.type) && i.status === 'in-progress'),
  );

  inProgressMovies = computed(() =>
    this.items().filter((i) => i.type === 'movie' && i.status === 'in-progress'),
  );

  history = computed(() => {
    const data = this.storageService.getDataSignal()();
    if (!data) {
      return [];
    }

    const history: HistoryEntry[] = [];

    for (const item of Object.values(data.items)) {
      for (const entry of item.watchHistory) {
        history.push({
          ...entry,
          itemId: item.id,
          itemTitle: item.title,
          itemType: item.type,
        });
      }
    }

    for (const deleted of Object.values(data.deletedItems ?? {})) {
      for (const entry of deleted.watchHistory) {
        history.push({
          ...entry,
          itemId: deleted.itemId,
          itemTitle: deleted.itemTitle,
          itemType: deleted.itemType,
          isDeleted: true,
        });
      }
    }

    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });
}
