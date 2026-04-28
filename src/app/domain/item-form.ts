import { Item, ItemStatus, ItemType } from '../models/item.model';
import { DEFAULT_GROUP_ID } from './item.constants';

export interface ItemFormValue {
  title: string;
  type: ItemType;
  groupId: string;
  status: ItemStatus;
  season: number;
  episode: number;
  totalEpisodes?: number;
  totalSeasons?: number;
  startImmediately: boolean;
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
    totalEpisodes: undefined,
    totalSeasons: undefined,
    startImmediately: false
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
    totalEpisodes: item.progress?.totalEpisodes,
    totalSeasons: item.progress?.totalSeasons,
    startImmediately: item.status === 'in-progress'
  };
}

export function buildItemMutationInput(formValue: ItemFormValue): ItemMutationInput {
  return {
    title: formValue.title.trim(),
    type: formValue.type,
    groupId: formValue.groupId,
    status: formValue.startImmediately ? 'in-progress' : formValue.status,
    progress:
      formValue.type === 'series'
        ? {
            season: formValue.season,
            episode: formValue.episode,
            totalEpisodes: formValue.totalEpisodes,
            totalSeasons: formValue.totalSeasons
          }
        : undefined
  };
}

export function prepareSubmittedItemFormValue(
  formValue: ItemFormValue,
  allowStartImmediately: boolean
): ItemFormValue {
  if (allowStartImmediately) {
    return formValue;
  }

  return {
    ...formValue,
    startImmediately: false
  };
}

export function normalizeFormValueForType(formValue: ItemFormValue): ItemFormValue {
  if (formValue.type === 'series') {
    return formValue;
  }

  return {
    ...formValue,
    season: 1,
    episode: 1,
    totalEpisodes: undefined,
    totalSeasons: undefined
  };
}
