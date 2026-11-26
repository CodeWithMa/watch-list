import { ReadonlyItem as Item } from '../models/item.model';
import { isEpisodicType } from '../domain/item.constants';

export function calculateProgress(item: Item): number | null {
  if (item.type === 'movie') {
    return item.status === 'completed' ? 100 : 0;
  }

  const { progress } = item;
  if (isEpisodicType(item.type) && progress) {
    if (item.status === 'completed') return 100;
    const currentSeason = progress.seasons.find((s) => s.seasonNumber === progress.season);
    const currentTotal = currentSeason?.totalEpisodes;
    if (currentTotal !== undefined && currentTotal > 0) {
      return Math.max(0, Math.round(((progress.episode - 1) / currentTotal) * 100));
    }
  }

  return null;
}

export function getMostRecentWatchDate(item: Item): string {
  if (item.watchHistory.length > 0) {
    const sorted = [...item.watchHistory].sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      const aVal = Number.isNaN(aTime) ? Number.NEGATIVE_INFINITY : aTime;
      const bVal = Number.isNaN(bTime) ? Number.NEGATIVE_INFINITY : bTime;
      return bVal - aVal;
    });
    return sorted[0].date;
  }
  return item.createdAt;
}
