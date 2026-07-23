export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toLocalDateKeyFromISO(iso: string): string {
  return toLocalDateKey(new Date(iso));
}

export function daysBetween(
  y1: number,
  m1: number,
  d1: number,
  y2: number,
  m2: number,
  d2: number,
): number {
  const toOrdinal = (y: number, m: number, d: number): number => {
    const a = Math.floor((14 - m) / 12);
    const y2 = y + 4800 - a;
    const m2 = m + 12 * a - 3;
    return (
      d +
      Math.floor((153 * m2 + 2) / 5) +
      365 * y2 +
      Math.floor(y2 / 4) -
      Math.floor(y2 / 100) +
      Math.floor(y2 / 400) -
      32045
    );
  };
  return toOrdinal(y2, m2, d2) - toOrdinal(y1, m1, d1);
}
