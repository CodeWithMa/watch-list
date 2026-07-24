export function toPositiveNumber(
  value: string | number | null | undefined,
  fallback: number,
): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export function toOptionalPositiveNumber(
  value: string | number | null | undefined,
): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1) {
    return undefined;
  }
  return parsed;
}

export function toOptionalDateString(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}
