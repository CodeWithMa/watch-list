import { TauriFileStorageAdapter } from '../app/services/storage.adapter.tauri';
import { TauriImportExportAdapter } from '../app/services/import-export.adapter.tauri';

export const environment = {
  isTauri: true,
  enableServiceWorker: false,
  storageAdapter: TauriFileStorageAdapter,
  importExportAdapter: TauriImportExportAdapter
};