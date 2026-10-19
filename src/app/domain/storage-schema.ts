import { z } from 'zod';
import { DEFAULT_GROUP_ID } from './item.constants';
import { CURRENT_SCHEMA_VERSION, DeletedItemHistory, StorageData } from '../models/storage.model';
import { Group } from '../models/group.model';
import { Item } from '../models/item.model';

const PositiveIntegerSchema = z.number().int().positive();
const NonblankStringSchema = z.string().refine((value) => value.trim().length > 0);
// History and creation dates must be real dates. Release metadata deliberately
// retains its older, more permissive YYYY-MM-DD contract below.
const DateSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true, local: true })]);

const SeasonInfoSchema = z.object({
  seasonNumber: PositiveIntegerSchema,
  totalEpisodes: PositiveIntegerSchema.optional(),
  snoozeCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  firstEpisodeAirDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const SeriesProgressSchema = z
  .object({
    season: PositiveIntegerSchema,
    episode: PositiveIntegerSchema,
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
  date: DateSchema,
  season: PositiveIntegerSchema.optional(),
  episode: PositiveIntegerSchema.optional(),
});

const ItemSchema = z.object({
  id: NonblankStringSchema,
  type: z.enum(['series', 'movie', 'ova', 'ona']),
  title: NonblankStringSchema,
  groupId: z.string(),
  status: z.enum(['not-started', 'in-progress', 'paused', 'completed', 'dropped']),
  progress: SeriesProgressSchema.optional(),
  availabilityDeferral: z
    .object({
      season: PositiveIntegerSchema,
      episode: PositiveIntegerSchema,
      until: z.iso.datetime({ offset: true }),
    })
    .optional(),
  watchHistory: z.array(WatchHistoryEntrySchema),
  createdAt: DateSchema,
  posterId: z.string().optional(),
  isAdult: z.boolean(),
});

const GroupSchema = z.object({
  id: NonblankStringSchema,
  name: z.string(),
  order: z.number(),
});

const DeletedItemHistorySchema = z.object({
  itemId: NonblankStringSchema,
  itemTitle: NonblankStringSchema,
  itemType: z.enum(['series', 'movie', 'ova', 'ona']),
  watchHistory: z.array(WatchHistoryEntrySchema),
  deletedAt: DateSchema,
});

// Migration handles untrusted records, not domain objects. Only parsing each
// record below grants it a domain type.
// Keep all own keys: z.record discards __proto__ before recovery can count it.
const UntrustedRecordsSchema = z.custom<Record<string, unknown>>(isRecord);
const StorageEnvelopeSchema = z.object({
  schemaVersion: z.number().int().nonnegative(),
  lastModifiedAt: z.string(),
  groups: UntrustedRecordsSchema,
  items: UntrustedRecordsSchema,
  deletedItems: UntrustedRecordsSchema.optional(),
});
type StorageEnvelope = z.infer<typeof StorageEnvelopeSchema>;

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

export interface DroppedRecords {
  groups: number;
  items: number;
  deletedItems: number;
}

export interface NormalizationReport {
  dropped: DroppedRecords;
  repairedGroupReferences: number;
}

export interface NormalizationResult extends NormalizationReport {
  data: StorageData;
}

export class UnsupportedSchemaVersionError extends Error {
  constructor(readonly version: number) {
    super(
      `This collection uses data version ${version}, but this app supports up to ${CURRENT_SCHEMA_VERSION}. ` +
        'Open it with a newer version of Watch List. No data was changed.',
    );
    this.name = 'UnsupportedSchemaVersionError';
  }
}

export function assertSupportedStorageVersion(data: unknown) {
  if (
    isRecord(data) &&
    typeof data['schemaVersion'] === 'number' &&
    Number.isFinite(data['schemaVersion']) &&
    data['schemaVersion'] > CURRENT_SCHEMA_VERSION
  ) {
    throw new UnsupportedSchemaVersionError(data['schemaVersion']);
  }
}

export function normalizeStorageData(data: unknown): NormalizationResult {
  assertSupportedStorageVersion(data);
  const envelope = StorageEnvelopeSchema.safeParse(data);
  if (!envelope.success) {
    throw new Error('Invalid data format');
  }

  return quarantineInvalidRecords(migrateStorageData(envelope.data));
}

function quarantineInvalidRecords(data: StorageEnvelope): NormalizationResult {
  const inputItemCount = Object.keys(data.items).length;

  const groups = new Map<string, Group>();
  let droppedGroups = 0;
  for (const [id, group] of Object.entries(data.groups ?? {})) {
    const parsed = GroupSchema.safeParse(group);
    if (parsed.success && parsed.data.id === id) {
      groups.set(id, parsed.data);
    } else {
      droppedGroups++;
    }
  }

  const items = new Map<string, Item>();
  let droppedItems = 0;
  for (const [id, item] of Object.entries(data.items ?? {})) {
    const parsed = ItemSchema.safeParse(item);
    if (parsed.success && parsed.data.id === id) {
      items.set(id, parsed.data);
    } else {
      droppedItems++;
    }
  }

  const deletedItems = new Map<string, DeletedItemHistory>();
  let droppedDeleted = 0;
  for (const [id, entry] of Object.entries(data.deletedItems ?? {})) {
    const parsed = DeletedItemHistorySchema.safeParse(entry);
    if (parsed.success && parsed.data.itemId === id) {
      deletedItems.set(id, parsed.data);
    } else {
      droppedDeleted++;
    }
  }

  if (inputItemCount > 0 && items.size === 0) {
    throw new Error('Invalid migrated data');
  }

  if (!groups.has(DEFAULT_GROUP_ID)) {
    groups.set(DEFAULT_GROUP_ID, createDefaultStorageData().groups[DEFAULT_GROUP_ID]);
  }

  let repairedGroupReferences = 0;
  for (const item of items.values()) {
    if (!groups.has(item.groupId)) {
      item.groupId = DEFAULT_GROUP_ID;
      repairedGroupReferences++;
    }
  }

  if (droppedGroups + droppedItems + droppedDeleted > 0) {
    console.warn(
      `Dropped ${droppedItems} invalid item(s), ${droppedGroups} invalid group(s), ` +
        `${droppedDeleted} invalid deleted entr(ies) during storage normalization.`,
    );
  }

  return {
    data: {
      ...data,
      groups: Object.fromEntries(groups),
      items: Object.fromEntries(items),
      deletedItems: Object.fromEntries(deletedItems),
    },
    dropped: { groups: droppedGroups, items: droppedItems, deletedItems: droppedDeleted },
    repairedGroupReferences,
  };
}

function migrateStorageData(data: StorageEnvelope): StorageEnvelope {
  if (data.schemaVersion >= CURRENT_SCHEMA_VERSION) {
    return structuredClone(data);
  }

  const migrated = structuredClone(data);

  if (migrated.schemaVersion < 3) {
    for (const item of Object.values(migrated.items)) {
      // Malformed records (null, primitives) pass through to quarantine,
      // which drops them after migration salvages the valid items.
      if (!isRecord(item)) {
        continue;
      }
      if (item['type'] === 'series' && isRecord(item['progress'])) {
        const progress = item['progress'];
        if (progress['totalEpisodes'] !== undefined) {
          progress['seasons'] = [
            {
              seasonNumber: progress['season'],
              totalEpisodes: progress['totalEpisodes'],
            },
          ];
          delete progress['totalEpisodes'];
        } else if (progress['seasons'] === undefined) {
          progress['seasons'] = [];
        }
        delete progress['totalSeasons'];
      }
    }
    migrated.schemaVersion = 3;
  }

  if (migrated.schemaVersion < 4) {
    migrated.schemaVersion = 4;
  }

  if (migrated.schemaVersion < 5) {
    for (const item of Object.values(migrated.items)) {
      if (!isRecord(item)) {
        continue;
      }
      if (!('posterPath' in item)) {
        Object.assign(item, { posterPath: undefined });
      }
    }
    migrated.schemaVersion = 5;
  }

  if (migrated.schemaVersion < 6) {
    for (const item of Object.values(migrated.items)) {
      if (!isRecord(item)) {
        continue;
      }
      // Remote URLs must never survive the offline-image migration. Existing
      // posters are deliberately cleared instead of being fetched at startup.
      delete item['posterPath'];
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
    // Introduce required isAdult. Existing items lack the field; default to false (SFW).
    for (const item of Object.values(migrated.items)) {
      if (!isRecord(item)) {
        continue;
      }
      if (typeof item['isAdult'] !== 'boolean') {
        item['isAdult'] = false;
      }
    }
    migrated.schemaVersion = 9;
  }

  if (migrated.schemaVersion < 10) {
    // Optional per-season release delay: absent counts mean zero, with no baseline rewrite.
    migrated.schemaVersion = 10;
  }

  if (migrated.schemaVersion < 11) {
    // Optional episode-specific availability deferrals; existing records stay valid.
    migrated.schemaVersion = 11;
  }

  return migrated;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
