import { ApplicationConfig, provideBrowserGlobalErrorListeners, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { STORAGE_ADAPTER, IStorageAdapter } from './services/storage.adapter';
import { LocalStorageAdapter } from './services/storage.adapter.local';
import { IMPORT_EXPORT_ADAPTER, IImportExportAdapter } from './services/import-export.adapter';
import { LocalImportExportAdapter } from './services/import-export.adapter.local';
import { StorageService } from './services/storage.service';

const storageAdapter: IStorageAdapter = new LocalStorageAdapter();
const importExportAdapter: IImportExportAdapter = new LocalImportExportAdapter();

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