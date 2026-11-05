import { Item, ReadonlyItem } from '../models/item.model';
import { formatEpisode } from '../utils/progress.utils';
import { isEpisodicType } from './item.constants';

/** The fields a watch command may change; title, poster, and group edits stay out of reach. */
type WatchState = Pick<Item, 'status' | 'progress' | 'watchHistory' | 'availabilityDeferral'>;

export interface WatchChange {
  itemId: string;
  title: string;
  type: Item['type'];
  before: WatchState;
  after: WatchState;
}

function captureWatchState({
  status,
  progress,
  watchHistory,
  availabilityDeferral,
}: ReadonlyItem): WatchState {
  return structuredClone({
    status,
    progress,
    watchHistory,
    availabilityDeferral,
  }) as WatchState;
}

export function recordWatchChange(item: Item, command: (item: Item) => void): WatchChange {
  const before = captureWatchState(item);
  command(item);
  return {
    itemId: item.id,
    title: item.title,
    type: item.type,
    before,
    after: captureWatchState(item),
  };
}

// Stored records may be rebuilt with a different key order, which is not a change.
function canonical(value: unknown) {
  return JSON.stringify(value, (_key, entry: unknown) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
      : entry,
  );
}

function sameState(left: WatchState, right: WatchState) {
  return canonical(left) === canonical(right);
}

/** Reverts only when nothing else changed the watch state after the command. */
export function revertWatchChange(item: Item, { before, after }: WatchChange) {
  if (!sameState(captureWatchState(item), after)) return false;
  const { availabilityDeferral, ...state } = structuredClone(before);
  Object.assign(item, state);
  if (availabilityDeferral) item.availabilityDeferral = availabilityDeferral;
  else delete item.availabilityDeferral;
  if (!state.progress) delete item.progress;
  return true;
}

/** Null when the command changed nothing and there is nothing to acknowledge or undo. */
export function describeWatchChange({ title, type, before, after }: WatchChange): string | null {
  if (sameState(before, after)) return null;

  if (after.watchHistory.length > before.watchHistory.length) {
    const logged = after.watchHistory[after.watchHistory.length - 1];
    if (!isEpisodicType(type)) return `${title} marked as watched`;
    const completed = after.status === 'completed' ? ' — title completed' : '';
    return `${title}: ${formatEpisode(logged)} logged${completed}`;
  }

  if (before.status !== after.status) {
    switch (after.status) {
      case 'dropped':
        return `${title} dropped — watch history kept`;
      case 'paused':
        return `${title} paused`;
      case 'completed':
        return `${title} marked completed`;
      case 'in-progress':
        return before.status === 'paused'
          ? `${title} resumed`
          : `${title} moved to currently watching`;
      default:
        return `${title} moved to not started`;
    }
  }

  if (after.availabilityDeferral) {
    const until = new Date(after.availabilityDeferral.until).toLocaleString([], {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    return `${title}: ${formatEpisode(after.availabilityDeferral)} hidden until ${until}`;
  }
  if (before.availabilityDeferral) return `${title}: availability deferral cleared`;

  return `${title}: release estimate updated`;
}
