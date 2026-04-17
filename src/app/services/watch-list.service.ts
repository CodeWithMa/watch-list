import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { Item, ItemType, ItemStatus, SeriesProgress, WatchHistoryEntry } from '../models/item.model';
import { StorageData } from '../models/storage.model';

export interface HistoryEntry extends WatchHistoryEntry {
  itemId: string;
  itemTitle: string;
  itemType: ItemType;
  isDeleted?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WatchListService {
  constructor(private storageService: StorageService) {}

  addItem(item: Omit<Item, 'id' | 'createdAt' | 'watchHistory'>): void {
    const data = this.storageService.getData();
    const id = this.generateId();
    const now = new Date().toISOString();
    
    const newItem: Item = {
      ...item,
      id,
      createdAt: now,
      status: item.status || 'not-started',
      watchHistory: []
    };

    this.storageService.saveData({
      ...data,
      items: {
        ...data.items,
        [id]: newItem
      }
    });
  }

  updateItem(item: Item): void {
    const data = this.storageService.getData();
    this.storageService.saveData({
      ...data,
      items: {
        ...data.items,
        [item.id]: item
      }
    });
  }

  deleteItem(itemId: string): void {
    const data = this.storageService.getData();
    const { [itemId]: removed, ...items } = data.items;
    
    if (!removed) {
      return;
    }
    
    const deletedItems = { ...(data.deletedItems || {}), [itemId]: {
      itemId,
      itemTitle: removed.title,
      itemType: removed.type,
      watchHistory: removed.watchHistory || [],
      deletedAt: new Date().toISOString()
    }};
    
    this.storageService.saveData({
      ...data,
      items,
      deletedItems
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
        watchHistory: [...item.watchHistory, { date: now }]
      });
    } else if (item.type === 'series') {
      const progress = item.progress || { season: 1, episode: 1 };
      let newProgress: SeriesProgress;
      let newStatus: ItemStatus = item.status;

      if (progress.totalEpisodes !== undefined) {
        if (progress.episode >= progress.totalEpisodes) {
          newStatus = 'completed';
          newProgress = progress;
        } else {
          newProgress = {
            ...progress,
            episode: progress.episode + 1
          };
          newStatus = 'in-progress';
        }
      } else {
        newProgress = {
          ...progress,
          episode: progress.episode + 1
        };
        newStatus = 'in-progress';
      }

      this.updateItem({
        ...item,
        status: newStatus,
        progress: newProgress,
        watchHistory: [...item.watchHistory, {
          date: now,
          season: progress.season,
          episode: progress.episode
        }]
      });
    }
  }

  markCompleted(itemId: string): void {
    const item = this.getItemById(itemId);
    if (!item) return;

    this.updateItem({
      ...item,
      status: 'completed'
    });
  }

  getItemById(itemId: string): Item | undefined {
    const data = this.storageService.getData();
    return data.items[itemId];
  }

  getItemsByStatus(status: ItemStatus): Item[] {
    return this.storageService.getItems().filter(item => item.status === status);
  }

  getItemsByType(type: ItemType): Item[] {
    return this.storageService.getItems().filter(item => item.type === type);
  }

  getItemsByGroup(groupId: string): Item[] {
    return this.storageService.getItems().filter(item => item.groupId === groupId);
  }

  getAllWatchHistory(): HistoryEntry[] {
    const data = this.storageService.getData();
    const items = Object.values(data.items);
    const deletedItems = data.deletedItems || {};
    const history: HistoryEntry[] = [];

    for (const item of items) {
      for (const entry of item.watchHistory) {
        history.push({
          ...entry,
          itemId: item.id,
          itemTitle: item.title,
          itemType: item.type
        });
      }
    }

    for (const deleted of Object.values(deletedItems)) {
      for (const entry of deleted.watchHistory) {
        history.push({
          ...entry,
          itemId: deleted.itemId,
          itemTitle: deleted.itemTitle,
          itemType: deleted.itemType,
          isDeleted: true
        });
      }
    }

    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  calculateProgress(item: Item): number | null {
    if (item.type === 'movie') {
      return item.status === 'completed' ? 100 : 0;
    }

    if (item.type === 'series' && item.progress?.totalEpisodes) {
      if (item.status === 'completed') return 100;
      const { episode, totalEpisodes } = item.progress;
      return Math.max(0, Math.round(((episode - 1) / totalEpisodes) * 100));
    }

    return null;
  }

  getMostRecentWatchDate(item: Item): string {
    if (item.watchHistory && item.watchHistory.length > 0) {
      const sorted = [...item.watchHistory].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return sorted[0].date;
    }
    return item.createdAt;
  }

  private generateId(): string {
    return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

