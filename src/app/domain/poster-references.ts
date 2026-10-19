import { Item } from '../models/item.model';

/** Mutates only the detached import/export items, never the published collection. */
export function removeUnavailablePosterReferences(
  items: Record<string, Item>,
  availableIds: ReadonlySet<string>,
) {
  const omittedIds = new Set<string>();
  for (const item of Object.values(items)) {
    if (item.posterId && !availableIds.has(item.posterId)) {
      omittedIds.add(item.posterId);
      delete item.posterId;
    }
  }
  return [...omittedIds];
}
