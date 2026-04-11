import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { StorageService } from './services/storage.service';
import { STORAGE_ADAPTER, IStorageAdapter } from './services/storage.adapter';
import { IMPORT_EXPORT_ADAPTER, IImportExportAdapter } from './services/import-export.adapter';

const storageAdapter: IStorageAdapter = new environment.storageAdapter();
const importExportAdapter: IImportExportAdapter = new environment.importExportAdapter();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: STORAGE_ADAPTER, useValue: storageAdapter },
    { provide: IMPORT_EXPORT_ADAPTER, useValue: importExportAdapter },
    ...(environment.enableServiceWorker
      ? [
          provideServiceWorker('ngsw-worker.js', {
            enabled: true,
            registrationStrategy: 'registerWhenStable:30000'
          })
        ]
      : [])
  ]
};