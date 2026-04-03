import { LocalStorageAdapter } from '../app/services/storage.adapter.local';
import { LocalImportExportAdapter } from '../app/services/import-export.adapter.local';

export const environment = {
  isTauri: false,
  enableServiceWorker: true,
  storageAdapter: LocalStorageAdapter,
  importExportAdapter: LocalImportExportAdapter
};