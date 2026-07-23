import { Item } from '../models/item.model';

export function calculateProgress(item: Item): number | null {
  if (item.type === 'movie') {
    return item.status === 'completed' ? 100 : 0;
  }

  if (item.type === 'series' && item.progress) {
    if (item.status === 'completed') return 100;
    const currentSeason = item.progress.seasons.find(
      (s) => s.seasonNumber === item.progress!.season,
    );
    const currentTotal = currentSeason?.totalEpisodes;
    if (currentTotal !== undefined && currentTotal > 0) {
      const { episode } = item.progress;
      return Math.max(0, Math.round(((episode - 1) / currentTotal) * 100));
    }
  }

  return null;
}

export function getMostRecentWatchDate(item: Item): string {
  if (item.watchHistory && item.watchHistory.length > 0) {
    const sorted = [...item.watchHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    return sorted[0].date;
  }
  return item.createdAt;
}
