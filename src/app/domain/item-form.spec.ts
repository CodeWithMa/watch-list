import {
  buildItemMutationInput,
  createDefaultItemFormValue,
  createItemFormValue,
  normalizeFormValueForType,
  prepareSubmittedItemFormValue,
} from './item-form';
import { Item } from '../models/item.model';

describe('item-form helpers', () => {
  it('creates the default form value', () => {
    expect(createDefaultItemFormValue()).toEqual({
      title: '',
      type: 'series',
      groupId: 'ungrouped',
      status: 'not-started',
      isAdult: false,
      season: 1,
      episode: 1,
      seasons: [],
      startImmediately: false,
    });
  });

  it('maps an item into the shared form shape', () => {
    const item: Item = {
      id: 'item-1',
      title: 'The Show',
      type: 'series',
      groupId: 'favorites',
      status: 'in-progress',
      isAdult: false,
      progress: {
        season: 2,
        episode: 4,
        seasons: [{ seasonNumber: 2, totalEpisodes: 10, firstEpisodeAirDate: '2026-05-01' }],
      },
      watchHistory: [],
      createdAt: '2026-04-20T08:00:00.000Z',
    };

    expect(createItemFormValue(item)).toEqual({
      title: 'The Show',
      type: 'series',
      groupId: 'favorites',
      status: 'in-progress',
      isAdult: false,
      season: 2,
      episode: 4,
      seasons: [{ seasonNumber: 2, totalEpisodes: 10, firstEpisodeAirDate: '2026-05-01' }],
      startImmediately: true,
    });
  });

  it('builds mutation input and prefers the start-immediately override', () => {
    const mutationInput = buildItemMutationInput({
      title: '  Movie Night  ',
      type: 'movie',
      groupId: 'ungrouped',
      status: 'not-started',
      isAdult: false,
      season: 1,
      episode: 1,
      seasons: [],
      startImmediately: true,
    });

    expect(mutationInput).toEqual({
      title: 'Movie Night',
      type: 'movie',
      groupId: 'ungrouped',
      status: 'in-progress',
      isAdult: false,
      progress: undefined,
    });
  });

  it('preserves first episode air dates when building series mutation input', () => {
    const mutationInput = buildItemMutationInput({
      title: 'Weekly Show',
      type: 'series',
      groupId: 'ungrouped',
      status: 'in-progress',
      isAdult: false,
      season: 1,
      episode: 3,
      seasons: [{ seasonNumber: 1, totalEpisodes: 10, firstEpisodeAirDate: '2026-05-01' }],
      startImmediately: false,
    });

    expect(mutationInput.progress?.seasons).toEqual([
      { seasonNumber: 1, totalEpisodes: 10, firstEpisodeAirDate: '2026-05-01' },
    ]);
  });

  it('preserves a paused status when building a movie mutation input', () => {
    const mutationInput = buildItemMutationInput({
      title: 'Paused Movie',
      type: 'movie',
      groupId: 'ungrouped',
      status: 'paused',
      isAdult: false,
      season: 1,
      episode: 1,
      seasons: [],
      startImmediately: false,
    });

    expect(mutationInput.status).toBe('paused');
  });

  it('disables the add-flow override when submitting with a status picker', () => {
    expect(
      prepareSubmittedItemFormValue(
        {
          title: 'Series',
          type: 'series',
          groupId: 'ungrouped',
          status: 'completed',
          isAdult: false,
          season: 1,
          episode: 5,
          seasons: [{ seasonNumber: 1, totalEpisodes: 10 }],
          startImmediately: true,
        },
        false,
      ),
    ).toEqual({
      title: 'Series',
      type: 'series',
      groupId: 'ungrouped',
      status: 'completed',
      isAdult: false,
      season: 1,
      episode: 5,
      seasons: [{ seasonNumber: 1, totalEpisodes: 10 }],
      startImmediately: false,
    });
  });

  it('clears series progress for movies', () => {
    expect(
      normalizeFormValueForType({
        title: 'Movie Night',
        type: 'movie',
        groupId: 'ungrouped',
        status: 'completed',
        isAdult: false,
        season: 4,
        episode: 9,
        seasons: [{ seasonNumber: 4, totalEpisodes: 12 }],
        startImmediately: false,
      }),
    ).toMatchObject({
      status: 'completed',
      isAdult: false,
      season: 1,
      episode: 1,
      seasons: [],
    });
  });

  it('preserves paused status when normalizing movies', () => {
    expect(
      normalizeFormValueForType({
        title: 'Paused Movie',
        type: 'movie',
        groupId: 'ungrouped',
        status: 'paused',
        isAdult: false,
        season: 3,
        episode: 4,
        seasons: [{ seasonNumber: 3, totalEpisodes: 8 }],
        startImmediately: false,
      }),
    ).toMatchObject({ status: 'paused', isAdult: false, season: 1, episode: 1, seasons: [] });
  });
});
