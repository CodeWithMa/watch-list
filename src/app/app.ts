import { Component, DOCUMENT, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { EMPTY, filter, map } from 'rxjs';
import { ThemeSwitcherComponent } from './components/theme-switcher/theme-switcher.component';
import { StorageService } from './services/storage.service';
import {
  ImportExportService,
  UnsupportedRecoveryFormatError,
} from './services/import-export.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeSwitcherComponent],
  templateUrl: './app.html',
  styles: [':host { display: block; min-height: 100vh; }'],
})
export class App {
  private readonly storageService = inject(StorageService);
  private readonly importExportService = inject(ImportExportService);
  private readonly document = inject(DOCUMENT);
  private readonly updates = inject(SwUpdate, { optional: true });
  protected readonly title = signal('watch-list');
  protected readonly saveError = this.storageService.getSaveErrorSignal();
  protected readonly inMemorySession = this.storageService.getInMemorySessionSignal();
  protected readonly compatibilityError = this.storageService.getCompatibilityErrorSignal();
  protected readonly databaseError = this.storageService.getDatabaseErrorSignal();
  protected readonly storageLoading = this.storageService.getLoadingSignal();
  protected readonly downloadError = signal<string | null>(null);
  protected readonly updateReady = toSignal(
    (this.updates?.isEnabled ? this.updates.versionUpdates : EMPTY).pipe(
      filter((event) => event.type === 'VERSION_READY'),
      map(() => true),
    ),
    { initialValue: false },
  );

  protected reload() {
    this.document.location.reload();
  }

  protected retryStorage() {
    void this.storageService.initialize();
  }

  protected downloadOriginal() {
    this.downloadError.set(null);
    try {
      this.importExportService.exportUnsupportedData();
    } catch (error) {
      this.downloadError.set(
        error instanceof UnsupportedRecoveryFormatError
          ? error.message
          : 'Could not download the original document. Please try again.',
      );
    }
  }
}
