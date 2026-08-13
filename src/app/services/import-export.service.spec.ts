import { TestBed } from '@angular/core/testing';
import { ImportExportService } from './import-export.service';
import { StorageService } from './storage.service';
import { ImageStorageService } from './image-storage.service';
import { vi, afterEach } from 'vitest';

describe('ImportExportService', () => {
  let importExportService: ImportExportService;
  let storageService: {
    getData: ReturnType<typeof vi.fn>;
    getRecoveryBackups: ReturnType<typeof vi.fn>;
    getRecoveryBackupByKey: ReturnType<typeof vi.fn>;
    importData: ReturnType<typeof vi.fn>;
  };
  let imageStorage: {
    exportImages: ReturnType<typeof vi.fn>;
    replaceImages: ReturnType<typeof vi.fn>;
  };

  function readBlobText(blob: Blob): Promise<string> {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });
  }

  beforeEach(() => {
    storageService = {
      getData: vi.fn(),
      getRecoveryBackups: vi.fn(),
      getRecoveryBackupByKey: vi.fn(),
      importData: vi.fn(),
    };
    imageStorage = {
      exportImages: vi.fn().mockResolvedValue([]),
      replaceImages: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: StorageService, useValue: storageService },
        { provide: ImageStorageService, useValue: imageStorage },
      ],
    });
    importExportService = TestBed.inject(ImportExportService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exportData', () => {
    it('downloads the current data as JSON', async () => {
      const exportPayload = { items: [], groups: {} };
      storageService.getData.mockReturnValue(exportPayload);
      const { anchor, createObjectURL, appendChild, removeChild, revokeObjectURL } = mockDownload();

      await importExportService.exportData();

      expect(storageService.getData).toHaveBeenCalledOnce();
      expect(anchor.download).toMatch(/^watch-list-export-\d{4}-\d{2}-\d{2}\.json$/);
      expect(anchor.href).toBe('blob:mock');
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(appendChild).toHaveBeenCalledOnce();
      expect(anchor.click).toHaveBeenCalledOnce();
      expect(removeChild).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledOnce();

      const blob = createObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobText(blob);
      expect(JSON.parse(text)).toEqual({ data: exportPayload, images: [] });
    });
  });

  describe('getRecoveryBackups', () => {
    it('delegates to the storage service', async () => {
      const backups = [{ key: 'watch-list-data-backup-1', timestamp: new Date() }];
      storageService.getRecoveryBackups.mockResolvedValue(backups);

      await expect(importExportService.getRecoveryBackups()).resolves.toEqual(backups);
      expect(storageService.getRecoveryBackups).toHaveBeenCalledOnce();
    });
  });

  describe('exportRecoveryBackup', () => {
    it('downloads the requested backup as JSON', async () => {
      const backupData = { schemaVersion: 1, data: 'test' };
      storageService.getRecoveryBackupByKey.mockResolvedValue(backupData);
      const { anchor, createObjectURL } = mockDownload();

      await importExportService.exportRecoveryBackup('watch-list-data-backup-123');

      expect(storageService.getRecoveryBackupByKey).toHaveBeenCalledWith(
        'watch-list-data-backup-123',
      );
      expect(anchor.download).toMatch(/^watch-list-recovery-backup-\d{4}-\d{2}-\d{2}\.json$/);
      expect(anchor.click).toHaveBeenCalledOnce();

      const blob = createObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobText(blob);
      expect(JSON.parse(text)).toEqual(backupData);
    });
  });

  describe('importData', () => {
    function mockFile(content: string): File {
      const file = new File([content], 'export.json', { type: 'application/json' });
      // jsdom File doesn't have .text(), add it
      Object.defineProperty(file, 'text', {
        value: vi.fn().mockResolvedValue(content),
        writable: true,
        configurable: true,
      });
      return file;
    }

    it('parses valid JSON and imports it', async () => {
      const file = mockFile('{"a":1}');
      storageService.importData.mockResolvedValue(undefined);

      await importExportService.importData(file);

      expect(storageService.importData).toHaveBeenCalledWith({ a: 1 });
    });

    it('throws a friendly error for invalid JSON', async () => {
      const file = mockFile('not json');

      await expect(importExportService.importData(file)).rejects.toThrow('Invalid JSON file');
      expect(storageService.importData).not.toHaveBeenCalled();
    });

    it('rethrows non-syntax errors from the storage service', async () => {
      const file = mockFile('{"a":1}');
      storageService.importData.mockRejectedValue(new Error('Storage busy'));

      await expect(importExportService.importData(file)).rejects.toThrow('Storage busy');
    });
  });

  function mockDownload(): {
    anchor: { click: ReturnType<typeof vi.fn>; href: string; download: string };
    createObjectURL: ReturnType<typeof vi.spyOn>;
    appendChild: ReturnType<typeof vi.spyOn>;
    removeChild: ReturnType<typeof vi.spyOn>;
    revokeObjectURL: ReturnType<typeof vi.spyOn>;
  } {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const anchor = { href: '', download: '', click: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(anchor as unknown as HTMLElement);
    const appendChild = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation(() => undefined as never);
    const removeChild = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation(() => undefined as never);

    return { anchor, createObjectURL, appendChild, removeChild, revokeObjectURL };
  }
});
