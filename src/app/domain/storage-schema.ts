import { z } from 'zod';
import { DEFAULT_GROUP_ID } from './item.constants';
import { CURRENT_SCHEMA_VERSION, StorageData } from '../models/storage.model';

interface LegacyProgressV2 {
  season: number;
  episode: number;
  totalEpisodes?: number;
  totalSeasons?: number;
  seasons?: { seasonNumber: number; totalEpisodes?: number }[];
}

const SeasonInfoSchema = z.object({
  seasonNumber: z.number(),
  totalEpisodes: z.number().optional(),
  firstEpisodeAirDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const SeriesProgressSchema = z
  .object({
    season: z.number(),
    episode: z.number(),
    seasons: z.array(SeasonInfoSchema),
  })
  .refine(
    (data) => {
      const seen = new Set<number>();
      return data.seasons.every((s) => {
        if (seen.has(s.seasonNumber)) return false;
        seen.add(s.seasonNumber);
        return true;
      });
    },
    { message: 'Duplicate season numbers in seasons array' },
  );

const WatchHistoryEntrySchema = z.object({
  date: z.string(),
  season: z.number().optional(),
  episode: z.number().optional(),
});

const ItemSchema = z.object({
  id: z.string(),
  type: z.enum(['series', 'movie', 'ova', 'ona']),
  title: z.string(),
  groupId: z.string(),
  status: z.enum(['not-started', 'in-progress', 'paused', 'completed', 'dropped']),
  progress: SeriesProgressSchema.optional(),
  watchHistory: z.array(WatchHistoryEntrySchema),
  createdAt: z.string(),
  posterId: z.string().optional(),
  isAdult: z.boolean().optional(),
});

const GroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
});

const DeletedItemHistorySchema = z.object({
  itemId: z.string(),
  itemTitle: z.string(),
  itemType: z.enum(['series', 'movie', 'ova', 'ona']),
  watchHistory: z.array(WatchHistoryEntrySchema),
  deletedAt: z.string(),
});

const StorageDataSchema = z.object({
  schemaVersion: z.number(),
  lastModifiedAt: z.string(),
  groups: z.record(z.string(), GroupSchema),
  items: z.record(z.string(), ItemSchema),
  deletedItems: z.record(z.string(), DeletedItemHistorySchema).optional(),
});

export function createDefaultStorageData(): StorageData {
  const now = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    lastModifiedAt: now,
    groups: {
      [DEFAULT_GROUP_ID]: {
        id: DEFAULT_GROUP_ID,
        name: 'Ungrouped',
        order: 0,
      },
    },
    items: {},
    deletedItems: {},
  };
}

export function normalizeStorageData(data: unknown): StorageData {
  if (!isStorageDataShape(data)) {
    throw new Error('Invalid data format');
  }

  const migrated = migrateStorageData(data);
  const normalized = applyStorageDefaults(migrated);

  const result = StorageDataSchema.safeParse(normalized);
  if (!result.success) {
    throw new Error('Invalid migrated data');
  }

  return result.data as StorageData;
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

  return true;
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
          progress.seasons = [
            {
              seasonNumber: progress.season,
              totalEpisodes: progress.totalEpisodes,
            },
          ];
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

  if (migrated.schemaVersion < 5) {
    for (const item of Object.values(migrated.items)) {
      if (!('posterPath' in item)) {
        Object.assign(item, { posterPath: undefined });
      }
    }
    migrated.schemaVersion = 5;
  }

  if (migrated.schemaVersion < 6) {
    for (const item of Object.values(migrated.items)) {
      // Remote URLs must never survive the offline-image migration. Existing
      // posters are deliberately cleared instead of being fetched at startup.
      delete (item as unknown as Record<string, unknown>)['posterPath'];
    }
    migrated.schemaVersion = 6;
  }

  if (migrated.schemaVersion < 7) {
    // Introduce 'paused' status. No auto-migration: existing 'not-started' items
    // remain in backlog even if they were previously paused via the lie.
    migrated.schemaVersion = 7;
  }

  if (migrated.schemaVersion < 8) {
    // Widen ItemType to include 'ova' and 'ona'. No data migration needed;
    // existing 'series'|'movie' values remain valid under the expanded enum.
    migrated.schemaVersion = 8;
  }

  if (migrated.schemaVersion < 9) {
    // Introduce isAdult. Existing items lack the field; leave undefined so
    // they are treated as non-adult (SFW) until edited. No forced backfill.
    migrated.schemaVersion = 9;
  }

  return migrated;
}

function applyStorageDefaults(data: StorageData): StorageData {
  return {
    ...data,
    groups: {
      [DEFAULT_GROUP_ID]: data.groups[DEFAULT_GROUP_ID] ?? {
        id: DEFAULT_GROUP_ID,
        name: 'Ungrouped',
        order: 0,
      },
      ...data.groups,
    },
    deletedItems: data.deletedItems ?? {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
