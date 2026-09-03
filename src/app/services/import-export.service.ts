import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { ImageStorageService } from './image-storage.service';
import { ProviderSettings, ProviderSettingsService } from './provider-settings.service';

export interface ExportPreferences {
  providerSettings: ProviderSettings;
}

export interface PortableExport {
  data: unknown;
  images: unknown;
  preferences?: ExportPreferences;
}

@Injectable({
  providedIn: 'root',
})
export class ImportExportService {
  private storageService = inject(StorageService);
  private imageStorage = inject(ImageStorageService);
  private providerSettings = inject(ProviderSettingsService);

  async exportData(options?: { includePreferences?: boolean }): Promise<void> {
    const payload: PortableExport = {
      data: this.storageService.getData(),
      images: await this.imageStorage.exportImages(),
    };
    // Only non-sensitive preferences are ever exported.
    // providerSettings (tmdb/jikan/anilist, includeAdult, titlePreference, adultDisplayMode)
    // is safe to share; tmdbReadAccessToken/apiKey from tmdb-settings.service.ts:3 are never read here.
    if (options?.includePreferences) {
      payload.preferences = {
        providerSettings: this.providerSettings.exportSettings(),
      };
    }
    this.downloadJson(payload, 'watch-list-export');
  }

  async getRecoveryBackups(): Promise<{ key: string; timestamp: Date }[]> {
    return this.storageService.getRecoveryBackups();
  }

  async exportRecoveryBackup(key: string): Promise<void> {
    const backup = await this.storageService.getRecoveryBackupByKey(key);
    this.downloadJson(backup, 'watch-list-recovery-backup');
  }

  private downloadJson(data: unknown, filenamePrefix: string): void {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenamePrefix}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async importData(file: File): Promise<void> {
    try {
      const text = await file.text();
      const payload: unknown = JSON.parse(text);
      const data = isPortableExport(payload) ? payload.data : payload;
      const images = await this.imageStorage.parseExportedImages(
        isPortableExport(payload) ? payload.images : [],
      );
      await this.storageService.importDataWithImages(data, images);
      this.applyPreferencesIfPresent(payload);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON file', { cause: error });
      }
      throw error;
    }
  }

  private applyPreferencesIfPresent(payload: unknown): void {
    if (!isPortableExport(payload) || !hasPreferences(payload)) {
      return;
    }
    const raw = payload.preferences.providerSettings;
    // Never import sensitive keys; ProviderSettingsService normalizes and ignores unknown fields.
    try {
      this.providerSettings.importSettings(raw);
    } catch {
      // Invalid preferences must never break the data import.
    }
  }
}

function isPortableExport(value: unknown): value is PortableExport {
  return !!value && typeof value === 'object' && 'data' in value && 'images' in value;
}

function hasPreferences(
  value: object,
): value is PortableExport & { preferences: ExportPreferences } {
  return (
    'preferences' in value &&
    !!value.preferences &&
    typeof value.preferences === 'object' &&
    'providerSettings' in (value.preferences as Record<string, unknown>)
  );
}
