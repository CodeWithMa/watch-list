import { IStorageAdapter } from '../app/services/storage.adapter';
import { IImportExportAdapter } from '../app/services/import-export.adapter';
import { LocalStorageAdapter } from '../app/services/storage.adapter.local';
import { LocalImportExportAdapter } from '../app/services/import-export.adapter.local';

export interface Environment {
  isTauri: boolean;
  enableServiceWorker: boolean;
  storageAdapter: new () => IStorageAdapter;
  importExportAdapter: new () => IImportExportAdapter;
}

export const environment: Environment = {
  isTauri: false,
  enableServiceWorker: false,
  storageAdapter: LocalStorageAdapter,
  importExportAdapter: LocalImportExportAdapter
};