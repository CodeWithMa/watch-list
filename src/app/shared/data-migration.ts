import { StorageData, CURRENT_SCHEMA_VERSION } from '../models/storage.model';
import { Item } from '../models/item.model';

export function migrateDataOnly(data: StorageData): StorageData {
  if (data.schemaVersion >= CURRENT_SCHEMA_VERSION) {
    return data;
  }

  let migrated = { ...data };

  if (migrated.schemaVersion < 2) {
    migrated.items = Object.fromEntries(
      Object.entries(migrated.items).map(([id, item]) => {
        const legacyItem = item as Item & {
          lastWatchedAt?: string;
          watchHistory?: unknown[];
          progress?: { season: number; episode: number; totalEpisodes?: number };
        };
        let watchHistory = legacyItem.watchHistory as any[] || [];

        let adjustedProgress = legacyItem.progress;
        if (adjustedProgress && legacyItem.status !== 'completed') {
          adjustedProgress = {
            ...adjustedProgress,
            episode: adjustedProgress.episode + 1
          };
        }

        if (watchHistory.length === 0 &&
            (legacyItem.status === 'in-progress' || legacyItem.lastWatchedAt !== legacyItem.createdAt)) {
          const entry: any = { date: legacyItem.lastWatchedAt };
          if (legacyItem.type === 'series' && legacyItem.progress) {
            entry.season = legacyItem.progress.season;
            entry.episode = legacyItem.progress.episode;
          }
          watchHistory = [entry];
        }

        const { lastWatchedAt, ...itemWithoutLastWatched } = legacyItem;
        return [id, { ...itemWithoutLastWatched, watchHistory, progress: adjustedProgress }];
      })
    );
    migrated.schemaVersion = 2;
  }

  return migrated;
}

export function ensureUngroupedGroup(data: StorageData): void {
  if (!data.groups['ungrouped']) {
    data.groups['ungrouped'] = {
      id: 'ungrouped',
      name: 'Ungrouped',
      order: 0
    };
  }
}

export function createDefaultData(): StorageData {
  const now = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    lastModifiedAt: now,
    settings: {
      showCompleted: false
    },
    groups: {
      ungrouped: {
        id: 'ungrouped',
        name: 'Ungrouped',
        order: 0
      }
    },
    items: {}
  };
}
