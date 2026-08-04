import { toPositiveNumber, toOptionalPositiveNumber, toOptionalDateString } from './form.utils';

describe('toPositiveNumber', () => {
  it('returns the fallback for null, undefined and empty string', () => {
    expect(toPositiveNumber(null, 5)).toBe(5);
    expect(toPositiveNumber(undefined, 5)).toBe(5);
    expect(toPositiveNumber('', 5)).toBe(5);
  });

  it('returns the fallback for non-numeric values', () => {
    expect(toPositiveNumber('abc', 5)).toBe(5);
  });

  it('returns the fallback for numbers below 1', () => {
    expect(toPositiveNumber(0, 5)).toBe(5);
    expect(toPositiveNumber('-3', 5)).toBe(5);
  });

  it('parses numeric strings and numbers as positive numbers', () => {
    expect(toPositiveNumber('12', 5)).toBe(12);
    expect(toPositiveNumber(7, 5)).toBe(7);
    expect(toPositiveNumber('3.5', 5)).toBe(3.5);
  });
});

describe('toOptionalPositiveNumber', () => {
  it('returns undefined for null, undefined and empty string', () => {
    expect(toOptionalPositiveNumber(null)).toBeUndefined();
    expect(toOptionalPositiveNumber(undefined)).toBeUndefined();
    expect(toOptionalPositiveNumber('')).toBeUndefined();
  });

  it('returns undefined for non-numeric values', () => {
    expect(toOptionalPositiveNumber('abc')).toBeUndefined();
  });

  it('returns undefined for numbers below 1', () => {
    expect(toOptionalPositiveNumber(0)).toBeUndefined();
    expect(toOptionalPositiveNumber('-3')).toBeUndefined();
  });

  it('parses numeric strings and numbers as positive numbers', () => {
    expect(toOptionalPositiveNumber('8')).toBe(8);
    expect(toOptionalPositiveNumber(9)).toBe(9);
  });
});

describe('toOptionalDateString', () => {
  it('returns undefined for falsy values', () => {
    expect(toOptionalDateString(null)).toBeUndefined();
    expect(toOptionalDateString(undefined)).toBeUndefined();
    expect(toOptionalDateString('')).toBeUndefined();
  });

  it('returns undefined for values that are not valid YYYY-MM-DD dates', () => {
    expect(toOptionalDateString('2026/05/01')).toBeUndefined();
    expect(toOptionalDateString('2026-5-1')).toBeUndefined();
    expect(toOptionalDateString('May 1, 2026')).toBeUndefined();
  });

  it('returns valid YYYY-MM-DD date strings unchanged', () => {
    expect(toOptionalDateString('2026-05-01')).toBe('2026-05-01');
  });
});
