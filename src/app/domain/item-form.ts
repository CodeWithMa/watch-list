import { Item, ItemStatus, ItemType, SeasonInfo } from '../models/item.model';
import { DEFAULT_GROUP_ID } from './item.constants';

export interface ItemFormValue {
  title: string;
  type: ItemType;
  groupId: string;
  status: ItemStatus;
  season: number;
  episode: number;
  seasons: SeasonInfo[];
  startImmediately: boolean;
  posterId?: string;
}

export type ItemMutationInput = Omit<Item, 'id' | 'createdAt' | 'watchHistory'>;

export function createDefaultItemFormValue(): ItemFormValue {
  return {
    title: '',
    type: 'series',
    groupId: DEFAULT_GROUP_ID,
    status: 'not-started',
    season: 1,
    episode: 1,
    seasons: [],
    startImmediately: false,
    posterId: undefined,
  };
}

export function createItemFormValue(item: Item): ItemFormValue {
  return {
    title: item.title,
    type: item.type,
    groupId: item.groupId,
    status: item.status,
    season: item.progress?.season ?? 1,
    episode: item.progress?.episode ?? 1,
    seasons: item.progress?.seasons ?? [],
    startImmediately: item.status === 'in-progress',
    posterId: item.posterId,
  };
}

export function buildItemMutationInput(formValue: ItemFormValue): ItemMutationInput {
  const sortedSeasons = [...formValue.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const rawStatus: ItemStatus = formValue.startImmediately ? 'in-progress' : formValue.status;
  return {
    title: formValue.title.trim(),
    type: formValue.type,
    groupId: formValue.groupId,
    status: rawStatus,
    progress:
      formValue.type === 'series'
        ? {
            season: formValue.season,
            episode: formValue.episode,
            seasons: sortedSeasons,
          }
        : undefined,
    posterId: formValue.posterId,
  };
}

export function prepareSubmittedItemFormValue(
  formValue: ItemFormValue,
  allowStartImmediately: boolean,
): ItemFormValue {
  if (allowStartImmediately) {
    return formValue;
  }

  return {
    ...formValue,
    startImmediately: false,
  };
}

export function normalizeFormValueForType(formValue: ItemFormValue): ItemFormValue {
  if (formValue.type === 'series') {
    return formValue;
  }

  const normalized: ItemFormValue = {
    ...formValue,
    season: 1,
    episode: 1,
    seasons: [],
  };
  return normalized;
}
