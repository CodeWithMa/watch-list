import { ReadonlyItem, SeriesProgress } from '../models/item.model';
import { isEpisodicType } from './item.constants';

/** Elapsed hours, bounded by the ISO date range supported by persistence. */
export function deferralReturnDate(hours: number, now = Date.now()) {
  if (!Number.isSafeInteger(hours) || hours <= 0) return null;
  const until = now + hours * 3_600_000;
  if (!Number.isSafeInteger(until) || until > 253402300799999) return null;
  const date = new Date(until);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function isCurrentEpisode(
  item: ReadonlyItem,
  { season, episode }: Pick<SeriesProgress, 'season' | 'episode'>,
) {
  return season === (item.progress?.season ?? 1) && episode === (item.progress?.episode ?? 1);
}

export function activeDeferralUntil(item: ReadonlyItem, now: number) {
  const deferral = item.availabilityDeferral;
  if (!isEpisodicType(item.type) || !deferral) return null;
  if (!isCurrentEpisode(item, deferral)) return null;
  return new Date(deferral.until).getTime() > now ? deferral.until : null;
}
