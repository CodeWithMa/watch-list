import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class ImportExportService {
  private storageService = inject(StorageService);

  exportData(): void {
    this.downloadJson(this.storageService.getData(), 'watch-list-export');
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
      await this.storageService.importData(JSON.parse(text));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON file', { cause: error });
      }
      throw error;
    }
  }
}
