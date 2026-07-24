import { Injectable, inject, computed } from '@angular/core';
import { StorageService } from './storage.service';
import { Item, ItemStatus, SeriesProgress } from '../models/item.model';
import { HistoryEntry } from '../models/storage.model';

@Injectable({
  providedIn: 'root',
})
export class WatchListService {
  private storageService = inject(StorageService);

  addItem(item: Omit<Item, 'id' | 'createdAt' | 'watchHistory'>): void {
    const data = this.storageService.getData();
    const id = this.generateId();
    const now = new Date().toISOString();

    const newItem: Item = {
      ...item,
      id,
      createdAt: now,
      watchHistory: [],
    };

    this.storageService.saveData({
      ...data,
      items: {
        ...data.items,
        [id]: newItem,
      },
    });
  }

  updateItem(item: Item): void {
    const data = this.storageService.getData();
    this.storageService.saveData({
      ...data,
      items: {
        ...data.items,
        [item.id]: item,
      },
    });
  }

  deleteItem(itemId: string): void {
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

    this.storageService.saveData({
      ...data,
      items,
      deletedItems,
    });
  }

  markWatched(itemId: string): void {
    const item = this.getItemById(itemId);
    if (!item) return;

    const now = new Date().toISOString();

    if (item.type === 'movie') {
      this.updateItem({
        ...item,
        status: 'completed',
        watchHistory: [...item.watchHistory, { date: now }],
      });
    } else if (item.type === 'series') {
      const progress = item.progress || { season: 1, episode: 1, seasons: [] };
      let newProgress: SeriesProgress;
      let newStatus: ItemStatus;

      const currentSeasonInfo = progress.seasons.find((s) => s.seasonNumber === progress.season);

      const currentTotal = currentSeasonInfo?.totalEpisodes;
      if (currentTotal !== undefined && currentTotal > 0 && progress.episode >= currentTotal) {
        const sortedSeasons = [...progress.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
        const nextSeasonInfo = sortedSeasons.find((s) => s.seasonNumber > progress.season);
        if (nextSeasonInfo) {
          newProgress = {
            ...progress,
            season: nextSeasonInfo.seasonNumber,
            episode: 1,
          };
          newStatus = 'in-progress';
        } else {
          newProgress = { ...progress };
          newStatus = 'completed';
        }
      } else {
        newProgress = {
          ...progress,
          episode: progress.episode + 1,
        };
        newStatus = 'in-progress';
      }

      this.updateItem({
        ...item,
        status: newStatus,
        progress: newProgress,
        watchHistory: [
          ...item.watchHistory,
          {
            date: now,
            season: progress.season,
            episode: progress.episode,
          },
        ],
      });
    }
  }

  markCompleted(itemId: string): void {
    const item = this.getItemById(itemId);
    if (!item) return;

    this.updateItem({
      ...item,
      status: 'completed',
    });
  }

  markDropped(itemId: string): void {
    const item = this.getItemById(itemId);
    if (!item) return;

    this.updateItem({
      ...item,
      status: 'dropped',
    });
  }

  markStarted(itemId: string): void {
    const item = this.getItemById(itemId);
    if (!item) return;

    this.updateItem({
      ...item,
      status: 'in-progress',
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
    this.items().filter((i) => i.type === 'series' && i.status === 'in-progress'),
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
