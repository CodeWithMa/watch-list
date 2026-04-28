import { DEFAULT_GROUP_ID, isItemStatus, isItemType } from './item.constants';
import { Item, WatchHistoryEntry } from '../models/item.model';
import { CURRENT_SCHEMA_VERSION, DeletedItemHistory, StorageData } from '../models/storage.model';
import { Group } from '../models/group.model';

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

  // Future migrations will be added here with version checks
  // if (migrated.schemaVersion < 3) { ... }

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
  return (
    typeof candidate['season'] === 'number' &&
    typeof candidate['episode'] === 'number' &&
    (candidate['totalEpisodes'] === undefined || typeof candidate['totalEpisodes'] === 'number')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
