import { Injectable, inject } from '@angular/core';
import { MutationResult, StorageService } from './storage.service';
import { ExportedImage, ImageStorageService } from './image-storage.service';
import { ProviderSettings, ProviderSettingsService } from './provider-settings.service';
import { assertSupportedStorageVersion, NormalizationReport } from '../domain/storage-schema';
import { removeUnavailablePosterReferences } from '../domain/poster-references';

export interface ExportPreferences {
  providerSettings: ProviderSettings;
}

export interface PosterCoverage {
  included: number;
  omittedIds: string[];
  unavailable: boolean;
}

export type ImportReport = NormalizationReport &
  Pick<MutationResult<void>, 'durability'> & {
    posters?: PosterCoverage;
  };

export interface PortableExport {
  data: unknown;
  images: unknown;
  preferences?: ExportPreferences;
  posters?: PosterCoverage;
}

export class UnsupportedRecoveryFormatError extends Error {
  constructor() {
    super(
      'This document contains data that cannot be preserved in JSON. No download was created. ' +
        "Keep this app's storage and open it with a newer version of Watch List to recover it.",
    );
    this.name = 'UnsupportedRecoveryFormatError';
  }
}

@Injectable({
  providedIn: 'root',
})
export class ImportExportService {
  private storageService = inject(StorageService);
  private imageStorage = inject(ImageStorageService);
  private providerSettings = inject(ProviderSettingsService);

  async exportData(): Promise<PosterCoverage> {
    const data = this.storageService.getData();
    let images: ExportedImage[] = [];
    let unavailable = false;
    try {
      images = await this.imageStorage.exportImages();
    } catch {
      unavailable = true;
    }
    const availableIds = new Set(images.map((image) => image.id));
    const omittedIds = removeUnavailablePosterReferences(data.items, availableIds);
    const posters = { included: images.length, omittedIds, unavailable };
    const payload: PortableExport = {
      data,
      images,
      posters,
      preferences: {
        providerSettings: this.providerSettings.exportSettings(),
      },
    };
    // Only non-sensitive preferences are ever exported.
    // providerSettings (tmdb/jikan/anilist, includeAdult, titlePreference, adultDisplayMode)
    // is safe to share; tmdbReadAccessToken/apiKey from tmdb-settings.service.ts:3 are never read here.
    this.downloadJson(payload, 'watch-list-export');
    return posters;
  }

  async getRecoveryBackups(): Promise<{ key: string; timestamp: Date }[]> {
    return this.storageService.getRecoveryBackups();
  }

  async exportRecoveryBackup(key: string): Promise<void> {
    const backup = await this.storageService.getRecoveryBackupByKey(key);
    this.downloadJson(backup, 'watch-list-recovery-backup');
  }

  exportUnsupportedData() {
    const raw = this.storageService.getUnsupportedData();
    assertLosslessJson(raw);
    this.downloadJson(raw, 'watch-list-original');
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

  async importData(file: File): Promise<ImportReport> {
    // Confirmation belongs to the currently reviewed context, before async file preparation.
    const context = this.storageService.captureImportContext();
    try {
      const text = await file.text();
      const payload: unknown = JSON.parse(text);
      // Unknown fields on a newer raw document may resemble today's export wrapper.
      assertSupportedStorageVersion(payload);
      const data = isPortableExport(payload) ? payload.data : payload;
      assertSupportedStorageVersion(data);
      const images = await this.imageStorage.parseExportedImages(
        isPortableExport(payload) ? payload.images : [],
      );
      const {
        dropped,
        repairedGroupReferences,
        durability,
        omittedPosterIds = [],
      } = await this.storageService.importDataWithImages(data, images, context);
      this.applyPreferencesIfPresent(payload);
      const coverage = readPosterCoverage(payload);
      const posters =
        coverage || omittedPosterIds.length
          ? {
              included: images.length,
              omittedIds: [...new Set([...(coverage?.omittedIds ?? []), ...omittedPosterIds])],
              unavailable: coverage?.unavailable ?? false,
            }
          : undefined;
      return { dropped, repairedGroupReferences, durability, ...(posters ? { posters } : {}) };
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

function readPosterCoverage(payload: unknown): PosterCoverage | undefined {
  if (!isPortableExport(payload)) return;
  const value = payload.posters;
  if (
    !value ||
    !Array.isArray(value.omittedIds) ||
    !value.omittedIds.every((id) => typeof id === 'string') ||
    typeof value.unavailable !== 'boolean' ||
    typeof value.included !== 'number'
  )
    return;
  return value;
}

function assertLosslessJson(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return;
  // Repeated references also lose their identity in JSON, even without a cycle.
  if (typeof value !== 'object' || seen.has(value)) {
    throw new UnsupportedRecoveryFormatError();
  }
  seen.add(value);
  const keys = Object.keys(value);
  if (Array.isArray(value)) {
    // JSON drops extra array properties and turns holes into null.
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      throw new UnsupportedRecoveryFormatError();
    }
  } else if (Object.prototype.toString.call(value) !== '[object Object]') {
    throw new UnsupportedRecoveryFormatError();
  }
  for (const child of Object.values(value)) assertLosslessJson(child, seen);
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
