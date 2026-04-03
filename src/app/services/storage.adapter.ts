import { InjectionToken } from '@angular/core';
import { StorageData } from '../models/storage.model';

export interface IStorageAdapter {
  load(): StorageData | Promise<StorageData>;
  save(data: StorageData): void | Promise<void>;
}

export const STORAGE_ADAPTER = new InjectionToken<IStorageAdapter>('STORAGE_ADAPTER');