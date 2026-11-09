import { titleMonogram } from './poster-fallback.component';

describe('titleMonogram', () => {
  it.each([
    ['Severance', 'S'],
    ['Past Lives', 'PL'],
    ['The Leftovers', 'L'],
    ['The Bear', 'B'],
    ['A Severely Long Title', 'SL'],
    ['House of the Dragon', 'HD'],
    ['Castlevania: Nocturne', 'CN'],
    ['Shōgun', 'S'],
    ['ōkami', 'Ō'],
    ['The', 'T'],
    ['2001: A Space Odyssey', '2S'],
    ['"Weird" Al', 'WA'],
    ['   ', ''],
  ])('%s → %s', (title, expected) => {
    expect(titleMonogram(title)).toBe(expected);
  });
});
