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

/** Hold ownership cleanup after its delete request succeeds but before it commits. */
export function holdPosterCleanup() {
  let released = false;
  let signalStarted = () => undefined as void;
  const started = new Promise<void>((resolve) => (signalStarted = resolve));
  const remove = IDBObjectStore.prototype.delete;
  vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (
    this: IDBObjectStore,
    key,
  ) {
    const request = remove.call(this, key);
    if (this.name === 'images') {
      request.addEventListener('success', () => {
        const keepAlive = () => {
          const read = this.get(key);
          read.addEventListener('success', () => {
            if (!released) keepAlive();
          });
        };
        keepAlive();
        signalStarted();
      });
    }
    return request;
  });
  return {
    started,
    release: () => {
      released = true;
    },
  };
}
