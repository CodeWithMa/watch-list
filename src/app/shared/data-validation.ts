import { StorageData } from '../models/storage.model';

export function validateStorageDataStructure(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const d = data as Record<string, unknown>;

  if (
    typeof d['schemaVersion'] !== 'number' ||
    typeof d['lastModifiedAt'] !== 'string' ||
    !d['settings'] ||
    !d['groups'] ||
    !d['items']
  ) {
    return false;
  }

  const settings = d['settings'] as Record<string, unknown>;
  if (typeof settings['showCompleted'] !== 'boolean') {
    return false;
  }

  if (typeof d['groups'] !== 'object' || Array.isArray(d['groups'])) {
    return false;
  }

  if (typeof d['items'] !== 'object' || Array.isArray(d['items'])) {
    return false;
  }

  return true;
}

export function validateStorageDataStructureWithGroups(data: unknown): boolean {
  if (!validateStorageDataStructure(data)) {
    return false;
  }

  const d = data as Record<string, unknown>;
  const groups = d['groups'] as Record<string, unknown>;
  for (const group of Object.values(groups)) {
    if (!validateGroup(group)) {
      return false;
    }
  }

  return true;
}

export function validateGroup(group: unknown): boolean {
  if (!group || typeof group !== 'object') {
    return false;
  }
  const g = group as Record<string, unknown>;
  return (
    typeof g['id'] === 'string' &&
    typeof g['name'] === 'string' &&
    typeof g['order'] === 'number'
  );
}

export function validateItem(item: unknown): boolean {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const i = item as Record<string, unknown>;

  if (
    typeof i['id'] !== 'string' ||
    typeof i['title'] !== 'string' ||
    typeof i['groupId'] !== 'string' ||
    typeof i['status'] !== 'string' ||
    typeof i['createdAt'] !== 'string' ||
    (i['type'] !== 'series' && i['type'] !== 'movie')
  ) {
    return false;
  }

  if (!Array.isArray(i['watchHistory'])) {
    return false;
  }
  for (const entry of i['watchHistory']) {
    if (!validateWatchHistoryEntry(entry)) {
      return false;
    }
  }

  if (i['type'] === 'series' && i['progress']) {
    const progress = i['progress'] as Record<string, unknown>;
    if (
      typeof progress['season'] !== 'number' ||
      typeof progress['episode'] !== 'number' ||
      (progress['totalEpisodes'] !== undefined && typeof progress['totalEpisodes'] !== 'number')
    ) {
      return false;
    }
  }

  return true;
}

export function validateWatchHistoryEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  const e = entry as Record<string, unknown>;
  return typeof e['date'] === 'string';
}

export function validateMigratedData(data: StorageData): boolean {
  const items = data.items;
  for (const item of Object.values(items)) {
    if (!validateItem(item)) {
      return false;
    }
  }
  return true;
}
