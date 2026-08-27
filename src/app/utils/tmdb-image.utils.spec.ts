import { getPosterUrl, getPlaceholderUrl } from './tmdb-image.utils';

describe('getPosterUrl', () => {
  it('returns null for undefined or empty', () => {
    expect(getPosterUrl(undefined)).toBeNull();
    expect(getPosterUrl('')).toBeNull();
  });

  it('prepends base url for paths starting with /', () => {
    expect(getPosterUrl('/poster.jpg')).toBe('https://image.tmdb.org/t/p/w342/poster.jpg');
  });

  it('returns absolute URL as is', () => {
    expect(getPosterUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(getPosterUrl('http://example.com/a.jpg')).toBe('http://example.com/a.jpg');
  });

  it('returns null for invalid non-URL strings without slash', () => {
    expect(getPosterUrl('not a url')).toBeNull();
    expect(getPosterUrl('poster.jpg')).toBeNull();
  });
});

describe('getPlaceholderUrl', () => {
  it('returns base64 data url', () => {
    const url = getPlaceholderUrl();
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const decoded = atob(url.split(',')[1]);
    expect(decoded).toContain('<svg');
  });
});
