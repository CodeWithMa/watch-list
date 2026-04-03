import { ApplicationConfig, provideBrowserGlobalErrorListeners, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { STORAGE_ADAPTER, IStorageAdapter } from './services/storage.adapter';
import { TauriFileStorageAdapter } from './services/storage.adapter.tauri';
import { IMPORT_EXPORT_ADAPTER, IImportExportAdapter } from './services/import-export.adapter';
import { TauriImportExportAdapter } from './services/import-export.adapter.tauri';
import { StorageService } from './services/storage.service';

const storageAdapter: IStorageAdapter = new TauriFileStorageAdapter();
const importExportAdapter: IImportExportAdapter = new TauriImportExportAdapter();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    {
      provide: APP_INITIALIZER,
      useFactory: (storageService: StorageService) => () => storageService.loadData(),
      deps: [StorageService],
      multi: true
    },
    { provide: STORAGE_ADAPTER, useValue: storageAdapter },
    { provide: IMPORT_EXPORT_ADAPTER, useValue: importExportAdapter }
  ]
};