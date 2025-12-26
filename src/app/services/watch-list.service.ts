import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { Item, ItemType, ItemStatus, SeriesProgress } from '../models/item.model';
import { StorageData } from '../models/storage.model';

@Injectable({
  providedIn: 'root'
})
export class WatchListService {
  constructor(private storageService: StorageService) {}

  addItem(item: Omit<Item, 'id' | 'createdAt' | 'lastWatchedAt'>): void {
    const data = this.storageService.getData();
    const id = this.generateId();
    const now = new Date().toISOString();
    
    const newItem: Item = {
      ...item,
      id,
      createdAt: now,
      lastWatchedAt: now, // New items have lastWatchedAt set to current date
      status: item.status || 'not-started'
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
    this.storageService.saveData({
      ...data,
      items
    });
  }

  markWatched(itemId: string): void {
    const item = this.getItemById(itemId);
    if (!item) return;

    const now = new Date().toISOString();

    if (item.type === 'movie') {
      // Movies are completed after a single watched action
      this.updateItem({
        ...item,
        status: 'completed',
        lastWatchedAt: now
      });
    } else if (item.type === 'series') {
      // Series progression logic
      const progress = item.progress || { season: 1, episode: 0 };
      let newProgress: SeriesProgress;
      let newStatus: ItemStatus = item.status;

      if (progress.totalEpisodes !== undefined) {
        // Has episode totals
        if (progress.episode >= progress.totalEpisodes) {
          // On last episode, mark as completed
          newStatus = 'completed';
          newProgress = progress;
        } else {
          // Advance to next episode
          newProgress = {
            ...progress,
            episode: progress.episode + 1
          };
          newStatus = 'in-progress';
        }
      } else {
        // No episode totals, auto-increment episode
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
        lastWatchedAt: now
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

  calculateProgress(item: Item): number | null {
    if (item.type === 'movie') {
      return item.status === 'completed' ? 100 : 0;
    }

    if (item.type === 'series' && item.progress?.totalEpisodes) {
      const { episode, totalEpisodes } = item.progress;
      return Math.round((episode / totalEpisodes) * 100);
    }

    return null;
  }

  private generateId(): string {
    return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

