import { TestBed } from '@angular/core/testing';
import { SeasonEditorComponent } from './season-editor.component';
import { SeasonInfo } from '../../models/item.model';

describe('SeasonEditorComponent', () => {
  let component: SeasonEditorComponent;
  let setSeasons: (seasons: SeasonInfo[]) => void;
  let emitted: SeasonInfo[][];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(SeasonEditorComponent);
    component = fixture.componentInstance;
    emitted = [];
    setSeasons = (seasons) => fixture.componentRef.setInput('seasons', seasons);
    component.seasonsChange.subscribe((seasons) => {
      emitted.push(seasons);
      setSeasons(seasons);
    });
  });

  describe('addSeason', () => {
    it('adds season 1 when there are no seasons', () => {
      setSeasons([]);

      component.addSeason();

      expect(emitted).toEqual([[{ seasonNumber: 1, totalEpisodes: undefined }]]);
    });

    it('adds a season after the highest season number', () => {
      setSeasons([{ seasonNumber: 2, totalEpisodes: 5 }]);

      component.addSeason();

      expect(emitted).toEqual([
        [
          { seasonNumber: 2, totalEpisodes: 5 },
          { seasonNumber: 3, totalEpisodes: undefined },
        ],
      ]);
    });

    it('handles non-contiguous season numbers by using the maximum plus one', () => {
      setSeasons([
        { seasonNumber: 1, totalEpisodes: 5 },
        { seasonNumber: 3, totalEpisodes: 8 },
      ]);

      component.addSeason();

      expect(emitted[0]).toEqual([
        { seasonNumber: 1, totalEpisodes: 5 },
        { seasonNumber: 3, totalEpisodes: 8 },
        { seasonNumber: 4, totalEpisodes: undefined },
      ]);
    });
  });

  describe('updateSeasonNumber', () => {
    it('updates the season number and emits', () => {
      setSeasons([{ seasonNumber: 1, totalEpisodes: 10 }]);

      component.updateSeasonNumber(0, 4);

      expect(emitted).toEqual([[{ seasonNumber: 4, totalEpisodes: 10 }]]);
    });

    it('does not emit when the new number duplicates another season', () => {
      setSeasons([
        { seasonNumber: 1, totalEpisodes: 10 },
        { seasonNumber: 2, totalEpisodes: 8 },
      ]);

      component.updateSeasonNumber(1, 1);

      expect(emitted).toEqual([]);
    });

    it('falls back to 1 for invalid input', () => {
      setSeasons([{ seasonNumber: 3, totalEpisodes: 10 }]);

      component.updateSeasonNumber(0, 'invalid');

      expect(emitted).toEqual([[{ seasonNumber: 1, totalEpisodes: 10 }]]);
    });

    it('ignores an out of range index', () => {
      setSeasons([{ seasonNumber: 1, totalEpisodes: 10 }]);

      component.updateSeasonNumber(5, 9);

      expect(emitted).toEqual([]);
    });
  });

  describe('updateSeasonEpisodes', () => {
    it('updates the episode count and emits', () => {
      setSeasons([{ seasonNumber: 1, totalEpisodes: 10 }]);

      component.updateSeasonEpisodes(0, 12);

      expect(emitted).toEqual([[{ seasonNumber: 1, totalEpisodes: 12 }]]);
    });

    it('clears the episode count for invalid input', () => {
      setSeasons([{ seasonNumber: 1, totalEpisodes: 10 }]);

      component.updateSeasonEpisodes(0, 'nope');

      expect(emitted).toEqual([[{ seasonNumber: 1, totalEpisodes: undefined }]]);
    });

    it('ignores an out of range index', () => {
      setSeasons([{ seasonNumber: 1, totalEpisodes: 10 }]);

      component.updateSeasonEpisodes(5, 12);

      expect(emitted).toEqual([]);
    });
  });

  describe('updateSeasonFirstAirDate', () => {
    it('normalizes a valid date and emits', () => {
      setSeasons([{ seasonNumber: 1, totalEpisodes: 10 }]);

      component.updateSeasonFirstAirDate(0, '2026-05-01');

      expect(emitted).toEqual([
        [{ seasonNumber: 1, totalEpisodes: 10, firstEpisodeAirDate: '2026-05-01' }],
      ]);
    });

    it('clears an invalid date', () => {
      setSeasons([{ seasonNumber: 1, totalEpisodes: 10, firstEpisodeAirDate: '2026-05-01' }]);

      component.updateSeasonFirstAirDate(0, 'May 1, 2026');

      expect(emitted).toEqual([
        [{ seasonNumber: 1, totalEpisodes: 10, firstEpisodeAirDate: undefined }],
      ]);
    });
  });

  describe('removeSeason', () => {
    it('removes the season at the given index and emits', () => {
      setSeasons([
        { seasonNumber: 1, totalEpisodes: 10 },
        { seasonNumber: 2, totalEpisodes: 8 },
      ]);

      component.removeSeason(0);

      expect(emitted).toEqual([[{ seasonNumber: 2, totalEpisodes: 8 }]]);
    });
  });
});
