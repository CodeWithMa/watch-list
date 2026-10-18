import { IDBObjectStore } from 'fake-indexeddb';
import { vi } from 'vitest';

/** Observe request success or abort selected collection writes before transaction completion. */
export function controlStorageWrites(
  outcomes: boolean[] = [],
  onRequestSuccess?: (index: number, store: IDBObjectStore) => void,
) {
  const put = IDBObjectStore.prototype.put;
  let index = 0;
  return vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    value,
    key,
  ) {
    const request = put.call(this, value, key);
    if (this.name === 'storage' && key === 'watch-list-data') {
      const current = index++;
      request.addEventListener('success', () => {
        onRequestSuccess?.(current, this);
        if (outcomes[current] === false) this.transaction.abort();
      });
    }
    return request;
  });
}

/** Keep a real transaction pending until release, without mocking application persistence. */
export function holdStorageWrite(index: number, onRequestSuccess?: (index: number) => void) {
  let released = false;
  let transaction: IDBTransaction | undefined;
  let signalStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  controlStorageWrites([], (current, store) => {
    onRequestSuccess?.(current);
    if (current !== index) return;
    transaction = store.transaction;
    const keepAlive = () => {
      const request = store.get('watch-list-data');
      request.addEventListener('success', () => {
        if (!released) keepAlive();
      });
    };
    keepAlive();
    signalStarted();
  });
  return {
    started,
    release: () => {
      released = true;
    },
    abort: () => {
      released = true;
      transaction?.abort();
    },
  };
}
