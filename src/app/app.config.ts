import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

// Service worker configuration
// To enable service worker support, install @angular/service-worker:
// npm install @angular/service-worker
// Then uncomment the following:
/*
import { provideServiceWorker } from '@angular/service-worker';
import { isDevMode } from '@angular/core';
*/

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes)
    // Uncomment when @angular/service-worker is installed:
    // provideServiceWorker('ngsw-worker.js', {
    //   enabled: !isDevMode(),
    //   registrationStrategy: 'registerWhenStable:30000'
    // })
  ]
};
