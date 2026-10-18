import { Injectable, inject, computed } from '@angular/core';
import { StorageService } from './storage.service';
import { Item, ItemStatus, SeriesProgress } from '../models/item.model';
import { HistoryEntry } from '../models/storage.model';
import { ImageStorageService } from './image-storage.service';
import { DEFAULT_GROUP_ID, isEpisodicType } from '../domain/item.constants';
import { applyItemEdit, ItemEdit } from '../domain/item-edit';
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

  addItem(item: Omit<Item, 'id' | 'createdAt' | 'watchHistory'>) {
    const id = this.generateId();
    const now = new Date().toISOString();

    const newItem: Item = {
      ...structuredClone(item),
      id,
      createdAt: now,
      watchHistory: [],
    };

    return this.storageService.mutate((draft) => {
      const added = {
        ...newItem,
        groupId: Object.hasOwn(draft.groups, newItem.groupId) ? newItem.groupId : DEFAULT_GROUP_ID,
      };
      draft.items[id] = added;
      return added;
    });
  }

  async updateItem(itemId: string, changes: ItemEdit) {
    const edit = structuredClone(changes);
    const result = await this.storageService.mutate((draft) => {
      if (!Object.hasOwn(draft.items, itemId)) {
        throw new Error('The edited item no longer exists. Refresh the item list and try again.');
      }
      const current = draft.items[itemId];
      const updated = applyItemEdit(current, edit);
      if (!Object.hasOwn(draft.groups, updated.groupId)) updated.groupId = DEFAULT_GROUP_ID;
      draft.items[itemId] = updated;
      return current.posterId !== updated.posterId ? current.posterId : undefined;
    });
    await this.cleanupPoster(result.value);
    return { ...result, value: undefined };
  }

  async deleteItem(itemId: string) {
    const result = await this.storageService.mutate((draft) => {
      if (!Object.hasOwn(draft.items, itemId)) return;
      const removed = draft.items[itemId];
      draft.deletedItems ??= {};
      draft.deletedItems[itemId] = {
        itemId,
        itemTitle: removed.title,
        itemType: removed.type,
        watchHistory: removed.watchHistory || [],
        deletedAt: new Date().toISOString(),
      };
      delete draft.items[itemId];
      return removed.posterId;
    });
    await this.cleanupPoster(result.value);
    return { ...result, value: undefined };
  }

  private async cleanupPoster(posterId: string | undefined) {
    if (!posterId) return;
    // Collection success is not undone by a later poster-cleanup failure.
    try {
      await this.imageStorage.delete(posterId);
    } catch (error) {
      console.error('Failed to remove unused poster:', error);
    }
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
