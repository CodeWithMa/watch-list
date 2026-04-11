import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { StorageData } from '../models/storage.model';
import { IMPORT_EXPORT_ADAPTER, IImportExportAdapter } from './import-export.adapter';
import { validateStorageDataStructureWithGroups, validateMigratedData } from '../shared/data-validation';
import { migrateDataOnly, ensureUngroupedGroup } from '../shared/data-migration';

@Injectable({
  providedIn: 'root'
})
export class ImportExportService {
  private readonly adapter = inject(IMPORT_EXPORT_ADAPTER);
  private readonly storageService = inject(StorageService);

  async exportData(): Promise<boolean> {
    const data = this.storageService.getData();
    return await this.adapter.exportData(data);
  }

  async importData(): Promise<boolean> {
    const result = await this.adapter.importData();

    if (!result) {
      return false;
    }

    const { data } = result;

    if (!validateStorageDataStructureWithGroups(data)) {
      throw new Error('Invalid data format');
    }

    if (!confirm('Importing will replace all existing data. Are you sure?')) {
      return false;
    }

    const migrated = migrateDataOnly(data);
    ensureUngroupedGroup(migrated);

    if (!validateMigratedData(migrated)) {
      throw new Error('Invalid migrated data');
    }

    await this.storageService.saveData(migrated);
    return true;
  }
}
