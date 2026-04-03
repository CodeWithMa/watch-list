import { IStorageAdapter } from '../app/services/storage.adapter';
import { IImportExportAdapter } from '../app/services/import-export.adapter';

export interface Environment {
  isTauri: boolean;
  enableServiceWorker: boolean;
  storageAdapter?: new () => IStorageAdapter;
  importExportAdapter?: new () => IImportExportAdapter;
}

export const environment: Environment = {
  isTauri: false,
  enableServiceWorker: false
};