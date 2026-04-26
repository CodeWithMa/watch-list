import {
  buildItemMutationInput,
  createDefaultItemFormValue,
  createItemFormValue,
  normalizeFormValueForType
} from './item-form';
import { Item } from '../models/item.model';

describe('item-form helpers', () => {
  it('creates the default form value', () => {
    expect(createDefaultItemFormValue()).toEqual({
      title: '',
      type: 'series',
      groupId: 'ungrouped',
      status: 'not-started',
      season: 1,
      episode: 1,
      totalEpisodes: undefined,
      startImmediately: false
    });
  });

  it('maps an item into the shared form shape', () => {
    const item: Item = {
      id: 'item-1',
      title: 'The Show',
      type: 'series',
      groupId: 'favorites',
      status: 'in-progress',
      progress: {
        season: 2,
        episode: 4,
        totalEpisodes: 10
      },
      watchHistory: [],
      createdAt: '2026-04-20T08:00:00.000Z'
    };

    expect(createItemFormValue(item)).toEqual({
      title: 'The Show',
      type: 'series',
      groupId: 'favorites',
      status: 'in-progress',
      season: 2,
      episode: 4,
      totalEpisodes: 10,
      startImmediately: true
    });
  });

  it('builds mutation input and prefers the start-immediately override', () => {
    const mutationInput = buildItemMutationInput({
      title: '  Movie Night  ',
      type: 'movie',
      groupId: 'ungrouped',
      status: 'not-started',
      season: 1,
      episode: 1,
      totalEpisodes: undefined,
      startImmediately: true
    });

    expect(mutationInput).toEqual({
      title: 'Movie Night',
      type: 'movie',
      groupId: 'ungrouped',
      status: 'in-progress',
      progress: undefined
    });
  });

  it('clears series progress for movies', () => {
    expect(
      normalizeFormValueForType({
        title: 'Movie Night',
        type: 'movie',
        groupId: 'ungrouped',
        status: 'completed',
        season: 4,
        episode: 9,
        totalEpisodes: 12,
        startImmediately: false
      })
    ).toEqual({
      title: 'Movie Night',
      type: 'movie',
      groupId: 'ungrouped',
      status: 'completed',
      season: 1,
      episode: 1,
      totalEpisodes: undefined,
      startImmediately: false
    });
  });
});
