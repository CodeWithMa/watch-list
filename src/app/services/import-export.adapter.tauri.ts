import { Injectable } from '@angular/core';
import { IImportExportAdapter } from './import-export.adapter';
import { StorageData } from '../models/storage.model';
import { save, open } from '@tauri-apps/plugin-dialog';

@Injectable()
export class TauriImportExportAdapter implements IImportExportAdapter {
  async exportData(data: StorageData): Promise<boolean> {
    const json = JSON.stringify(data, null, 2);
    
    const filePath = await save({
      defaultPath: `watch-list-export-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{
        name: 'JSON',
        extensions: ['json']
      }]
    });

    if (!filePath) {
      return false;
    }

    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(filePath, json);
    return true;
  }

  async importData(): Promise<{ file: File; data: StorageData } | null> {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'JSON',
        extensions: ['json']
      }]
    });

    if (!selected || typeof selected !== 'string') {
      return null;
    }

    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const content = await readTextFile(selected);
      const parsed = JSON.parse(content);
      
      if (!this.validateStorageDataStructure(parsed)) {
        throw new Error('Invalid data format');
      }

      const fileName = selected.split(/[/\\]/).pop() || 'import.json';
      const file = new File([content], fileName, { type: 'application/json' });
      
      return { file, data: parsed as StorageData };
    } catch (error) {
      console.error('Import error:', error);
      throw error;
    }
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