import { IImportExportAdapter } from './import-export.adapter';
import { StorageData } from '../models/storage.model';

export class LocalImportExportAdapter implements IImportExportAdapter {
  exportData(data: StorageData): boolean {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `watch-list-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }

  async importData(): Promise<{ file: File; data: StorageData } | null> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.addEventListener('cancel', () => resolve(null));
      
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          
          if (!this.validateStorageDataStructure(parsed)) {
            throw new Error('Invalid data format');
          }
          
          resolve({ file, data: parsed as StorageData });
        } catch (error) {
          console.error('Import error:', error);
          reject(error);
        }
      };
      
      input.click();
    });
  }

  private validateStorageDataStructure(data: unknown): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const d = data as Record<string, unknown>;

    if (
      typeof d['schemaVersion'] !== 'number' ||
      typeof d['lastModifiedAt'] !== 'string' ||
      !d['settings'] ||
      !d['groups'] ||
      !d['items']
    ) {
      return false;
    }

    const settings = d['settings'] as Record<string, unknown>;
    if (typeof settings['showCompleted'] !== 'boolean') {
      return false;
    }

    if (typeof d['groups'] !== 'object' || Array.isArray(d['groups'])) {
      return false;
    }

    if (typeof d['items'] !== 'object' || Array.isArray(d['items'])) {
      return false;
    }

    return true;
  }
}