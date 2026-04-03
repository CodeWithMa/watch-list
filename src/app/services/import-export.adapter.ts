import { InjectionToken } from '@angular/core';
import { StorageData } from '../models/storage.model';

export interface IImportExportAdapter {
  exportData(data: StorageData): void | Promise<void>;
  importData(): Promise<{ file: File; data: StorageData } | null>;
}

export const IMPORT_EXPORT_ADAPTER = new InjectionToken<IImportExportAdapter>('IMPORT_EXPORT_ADAPTER');