import { Item, SeasonInfo, SeriesProgress } from '../models/item.model';
import { isEpisodicType } from './item.constants';

type EditableFields = Omit<
  Item,
  'id' | 'createdAt' | 'watchHistory' | 'progress' | 'availabilityDeferral'
>;

const REMOVE = null;
type Remove = typeof REMOVE;
type SeasonPatch = Partial<SeasonInfo> | Remove;
type ProgressPatch = Partial<Omit<SeriesProgress, 'seasons'>> & {
  seasons?: Record<number, SeasonPatch>;
};

export type ItemEdit = Partial<EditableFields> & { progress?: ProgressPatch | Remove };

export function createItemEdit(
  before: EditableFields & Pick<Item, 'progress'>,
  after: EditableFields & Pick<Item, 'progress'>,
): ItemEdit {
  const previous = before.progress;
  const next = after.progress;
  const edit: ItemEdit = changedFields(editableFields(before), editableFields(after));
  const base = previous ?? (isEpisodicType(before.type) ? defaultProgress() : undefined);
  if (!next) {
    if (previous) edit.progress = REMOVE;
  } else {
    const { seasons: oldSeasons, ...oldPosition } = base ?? defaultProgress();
    const { seasons: newSeasons, ...newPosition } = next;
    const seasons: Record<number, SeasonPatch> = {};
    for (const old of oldSeasons) {
      if (!newSeasons.some((season) => season.seasonNumber === old.seasonNumber)) {
        seasons[old.seasonNumber] = REMOVE;
      }
    }
    for (const season of newSeasons) {
      const old = oldSeasons.find((candidate) => candidate.seasonNumber === season.seasonNumber);
      const changes = old ? changedFields(old, season) : season;
      if (Object.keys(changes).length) seasons[season.seasonNumber] = changes;
    }
    const progress: ProgressPatch = changedFields(oldPosition, newPosition);
    if (Object.keys(seasons).length) progress.seasons = seasons;
    if (Object.keys(progress).length || !base) edit.progress = progress;
  }
  return edit;
}

export function applyItemEdit(item: Item, edit: ItemEdit): Item {
  const { progress, ...fields } = edit;
  const updated = { ...item, ...fields };
  if (progress === REMOVE || !isEpisodicType(updated.type)) {
    delete updated.progress;
  } else if (progress) {
    const { seasons, ...position } = progress;
    const current = updated.progress ?? defaultProgress();
    const records = new Map(current.seasons.map((season) => [season.seasonNumber, season]));
    for (const [key, changes] of Object.entries(seasons ?? {})) {
      const seasonNumber = Number(key);
      if (changes === REMOVE) records.delete(seasonNumber);
      else records.set(seasonNumber, { ...records.get(seasonNumber), ...changes, seasonNumber });
    }
    updated.progress = {
      ...current,
      ...position,
      seasons: [...records.values()].sort((a, b) => a.seasonNumber - b.seasonNumber),
    };
  }
  return updated;
}

function defaultProgress(): SeriesProgress {
  return { season: 1, episode: 1, seasons: [] };
}

function editableFields(item: EditableFields): EditableFields {
  const { title, type, groupId, status, posterId, isAdult } = item;
  return { title, type, groupId, status, posterId, isAdult };
}

function changedFields<T extends { [K in keyof T]: string | number | boolean | undefined }>(
  before: T,
  after: T,
) {
  const changes: Partial<T> = {};
  for (const key of Object.keys({ ...before, ...after }) as (keyof T)[]) {
    if (before[key] !== after[key]) changes[key] = after[key];
  }
  return changes;
}
