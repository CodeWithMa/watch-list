import { DEFAULT_GROUP_ID, isItemStatus, isItemType } from './item.constants';
import { Item, SeasonInfo, WatchHistoryEntry } from '../models/item.model';
import { CURRENT_SCHEMA_VERSION, DeletedItemHistory, StorageData } from '../models/storage.model';
import { Group } from '../models/group.model';

interface LegacyProgressV2 {
  season: number;
  episode: number;
  totalEpisodes?: number;
  totalSeasons?: number;
  seasons?: SeasonInfo[];
}

export function createDefaultStorageData(): StorageData {
  const now = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    lastModifiedAt: now,
    groups: {
      [DEFAULT_GROUP_ID]: {
        id: DEFAULT_GROUP_ID,
        name: 'Ungrouped',
        order: 0
      }
    },
    items: {},
    deletedItems: {}
  };
}

export function normalizeStorageData(data: unknown): StorageData {
  if (!isStorageDataShape(data)) {
    throw new Error('Invalid data format');
  }

  const migrated = migrateStorageData(data);
  const normalized = applyStorageDefaults(migrated);

  if (!isNormalizedStorageData(normalized)) {
    throw new Error('Invalid migrated data');
  }

  return normalized;
}

function migrateStorageData(data: StorageData): StorageData {
  if (data.schemaVersion >= CURRENT_SCHEMA_VERSION) {
    return { ...data };
  }

  const migrated = { ...data };

  if (migrated.schemaVersion < 3) {
    for (const item of Object.values(migrated.items)) {
      if (item.type === 'series' && item.progress) {
        const progress = item.progress as unknown as LegacyProgressV2;
        if ('totalEpisodes' in progress && typeof progress.totalEpisodes === 'number') {
          progress.seasons = [{
            seasonNumber: progress.season,
            totalEpisodes: progress.totalEpisodes
          }];
          delete progress.totalEpisodes;
        } else if (!progress.seasons) {
          progress.seasons = [];
        }
        if ('totalSeasons' in progress) {
          delete progress.totalSeasons;
        }
      }
    }
    migrated.schemaVersion = 3;
  }

  if (migrated.schemaVersion < 4) {
    migrated.schemaVersion = 4;
  }

  return migrated;
}

function applyStorageDefaults(data: StorageData): StorageData {
  return {
    ...data,
    groups: {
      [DEFAULT_GROUP_ID]:
        data.groups[DEFAULT_GROUP_ID] ?? {
          id: DEFAULT_GROUP_ID,
          name: 'Ungrouped',
          order: 0
        },
      ...data.groups
    },
    deletedItems: data.deletedItems ?? {}
  };
}

function isStorageDataShape(data: unknown): data is StorageData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const candidate = data as Record<string, unknown>;

  if (
    typeof candidate['schemaVersion'] !== 'number' ||
    typeof candidate['lastModifiedAt'] !== 'string' ||
    !candidate['groups'] ||
    !candidate['items']
  ) {
    return false;
  }

  if (!isRecord(candidate['groups']) || !isRecord(candidate['items'])) {
    return false;
  }

  if (candidate['deletedItems'] !== undefined && !isRecord(candidate['deletedItems'])) {
    return false;
  }

  return Object.values(candidate['groups']).every(isGroup);
}

function isNormalizedStorageData(data: StorageData): boolean {
  return (
    Object.values(data.groups).every(isGroup) &&
    Object.values(data.items).every(isItem) &&
    Object.values(data.deletedItems ?? {}).every(isDeletedItem)
  );
}

function isGroup(group: unknown): group is Group {
  if (!group || typeof group !== 'object') {
    return false;
  }

  const candidate = group as Record<string, unknown>;
  return (
    typeof candidate['id'] === 'string' &&
    typeof candidate['name'] === 'string' &&
    typeof candidate['order'] === 'number'
  );
}

function isItem(item: unknown): item is Item {
  if (!item || typeof item !== 'object') {
    return false;
  }

  const candidate = item as Record<string, unknown>;

  if (
    typeof candidate['id'] !== 'string' ||
    typeof candidate['title'] !== 'string' ||
    typeof candidate['groupId'] !== 'string' ||
    !isItemStatus(candidate['status']) ||
    typeof candidate['createdAt'] !== 'string' ||
    !isItemType(candidate['type']) ||
    !Array.isArray(candidate['watchHistory'])
  ) {
    return false;
  }

  if (!candidate['watchHistory'].every(isWatchHistoryEntry)) {
    return false;
  }

  if (candidate['type'] === 'series' && candidate['progress'] !== undefined) {
    return isSeriesProgress(candidate['progress']);
  }

  return true;
}

function isDeletedItem(entry: unknown): entry is DeletedItemHistory {
  if (!entry || typeof entry !== 'object') {
    return false;
  }

  const candidate = entry as Record<string, unknown>;
  return (
    typeof candidate['itemId'] === 'string' &&
    typeof candidate['itemTitle'] === 'string' &&
    isItemType(candidate['itemType']) &&
    typeof candidate['deletedAt'] === 'string' &&
    Array.isArray(candidate['watchHistory']) &&
    candidate['watchHistory'].every(isWatchHistoryEntry)
  );
}

function isWatchHistoryEntry(entry: unknown): entry is WatchHistoryEntry {
  if (!entry || typeof entry !== 'object') {
    return false;
  }

  const candidate = entry as Record<string, unknown>;
  return typeof candidate['date'] === 'string';
}

function isSeriesProgress(progress: unknown): boolean {
  if (!progress || typeof progress !== 'object') {
    return false;
  }

  const candidate = progress as Record<string, unknown>;

  if (typeof candidate['season'] !== 'number' || typeof candidate['episode'] !== 'number') {
    return false;
  }

  if (!Array.isArray(candidate['seasons'])) {
    return false;
  }

  const seenSeasonNumbers = new Set<number>();
  for (const entry of candidate['seasons'] as unknown[]) {
    if (!entry || typeof entry !== 'object') {
      return false;
    }
    const seasonEntry = entry as Record<string, unknown>;
    if (typeof seasonEntry['seasonNumber'] !== 'number') {
      return false;
    }
    if (seasonEntry['totalEpisodes'] !== undefined && typeof seasonEntry['totalEpisodes'] !== 'number') {
      return false;
    }
    if (
      seasonEntry['firstEpisodeAirDate'] !== undefined &&
      (typeof seasonEntry['firstEpisodeAirDate'] !== 'string' ||
        !isDateOnlyString(seasonEntry['firstEpisodeAirDate']))
    ) {
      return false;
    }
    if (seenSeasonNumbers.has(seasonEntry['seasonNumber'])) {
      return false;
    }
    seenSeasonNumbers.add(seasonEntry['seasonNumber']);
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
