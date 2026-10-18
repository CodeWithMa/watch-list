import { IDBObjectStore } from 'fake-indexeddb';
import { vi } from 'vitest';

/** Observe request success or abort selected collection writes before transaction completion. */
export function controlStorageWrites(
  outcomes: boolean[] = [],
  onRequestSuccess?: (index: number) => void,
) {
  const put = IDBObjectStore.prototype.put;
  let index = 0;
  return vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    value,
    key,
  ) {
    const request = put.call(this, value, key);
    if (this.name === 'storage') {
      const current = index++;
      request.addEventListener('success', () => {
        onRequestSuccess?.(current);
        if (outcomes[current] === false) this.transaction.abort();
      });
    }
    return request;
  });
}
