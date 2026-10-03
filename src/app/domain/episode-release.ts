import { Item, SeasonInfo } from '../models/item.model';
import { isEpisodicType } from './item.constants';

export function getCurrentSeason(item: Item) {
  return isEpisodicType(item.type)
    ? item.progress?.seasons.find((season) => season.seasonNumber === item.progress?.season)
    : undefined;
}

export function isValidSnoozeCount(count: number) {
  return Number.isSafeInteger(count) && count >= 0;
}

export function getEpisodeAirDate(season: SeasonInfo, episode: number): Date | null {
  const baseline = season.firstEpisodeAirDate;
  const count = season.snoozeCount ?? 0;
  if (!baseline || !/^\d{4}-\d{2}-\d{2}$/.test(baseline) || !isValidSnoozeCount(count)) {
    return null;
  }

  const [year, month, day] = baseline.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  // Calendar-day arithmetic keeps local midnight across daylight-saving changes.
  date.setDate(date.getDate() + (Math.max(0, episode - 1) + count) * 7);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getCurrentEpisodeAirDate(item: Item) {
  const season = getCurrentSeason(item);
  return season && item.progress ? getEpisodeAirDate(season, item.progress.episode) : null;
}

export function canSnoozeCurrentSeason(item: Item) {
  const season = getCurrentSeason(item);
  return (
    item.status === 'in-progress' &&
    !!season &&
    !!item.progress &&
    isValidSnoozeCount(season.snoozeCount ?? 0) &&
    getEpisodeAirDate(
      { ...season, snoozeCount: (season.snoozeCount ?? 0) + 1 },
      item.progress.episode,
    ) !== null
  );
}

export function startOfLocalDay(date: Date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}
