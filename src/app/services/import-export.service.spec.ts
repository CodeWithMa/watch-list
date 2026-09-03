import { TestBed } from '@angular/core/testing';
import { ImportExportService } from './import-export.service';
import { StorageService } from './storage.service';
import { ImageStorageService } from './image-storage.service';
import { ProviderSettingsService } from './provider-settings.service';
import { vi, afterEach } from 'vitest';

describe('ImportExportService', () => {
  let importExportService: ImportExportService;
  let storageService: {
    getData: ReturnType<typeof vi.fn>;
    getRecoveryBackups: ReturnType<typeof vi.fn>;
    getRecoveryBackupByKey: ReturnType<typeof vi.fn>;
    importDataWithImages: ReturnType<typeof vi.fn>;
  };
  let imageStorage: {
    exportImages: ReturnType<typeof vi.fn>;
    parseExportedImages: ReturnType<typeof vi.fn>;
  };
  let providerSettings: {
    exportSettings: ReturnType<typeof vi.fn>;
    importSettings: ReturnType<typeof vi.fn>;
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
      importDataWithImages: vi.fn(),
    };
    imageStorage = {
      exportImages: vi
        .fn()
        .mockResolvedValue([{ id: 'poster-1', type: 'image/png', data: 'base64-data' }]),
      parseExportedImages: vi.fn().mockResolvedValue([]),
    };
    providerSettings = {
      exportSettings: vi.fn().mockReturnValue({
        tmdb: false,
        jikan: true,
        anilist: false,
        includeAdult: true,
        titlePreference: ['native', 'english', 'romaji'],
        adultDisplayMode: 'hide',
      }),
      importSettings: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: StorageService, useValue: storageService },
        { provide: ImageStorageService, useValue: imageStorage },
        { provide: ProviderSettingsService, useValue: providerSettings },
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
      expect(JSON.parse(text)).toEqual({
        data: exportPayload,
        images: [{ id: 'poster-1', type: 'image/png', data: 'base64-data' }],
      });
    });

    it('omits preferences by default', async () => {
      storageService.getData.mockReturnValue({ items: [] });
      const { createObjectURL } = mockDownload();

      await importExportService.exportData();

      const blob = createObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobText(blob);
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(parsed).not.toHaveProperty('preferences');
      expect(providerSettings.exportSettings).not.toHaveBeenCalled();
    });

    it('includes non-sensitive preferences when requested and never leaks tokens', async () => {
      storageService.getData.mockReturnValue({ items: [] });
      // Simulate tokens in localStorage – service must not read them
      const store: Record<string, string> = {};
      const mockStorage = {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          for (const k of Object.keys(store)) delete store[k];
        },
      } as unknown as Storage;
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });
      window.localStorage.setItem('tmdbReadAccessToken', 'secret-token');
      window.localStorage.setItem('tmdbApiKey', 'secret-key');
      const { createObjectURL } = mockDownload();

      await importExportService.exportData({ includePreferences: true });

      const blob = createObjectURL.mock.calls[0][0] as Blob;
      const text = await readBlobText(blob);
      expect(text).not.toContain('secret-token');
      expect(text).not.toContain('secret-key');
      expect(text).not.toContain('tmdbReadAccessToken');
      expect(text).not.toContain('tmdbApiKey');
      const parsed = JSON.parse(text) as {
        preferences: { providerSettings: Record<string, unknown> };
      };
      expect(parsed.preferences.providerSettings).toEqual({
        tmdb: false,
        jikan: true,
        anilist: false,
        includeAdult: true,
        titlePreference: ['native', 'english', 'romaji'],
        adultDisplayMode: 'hide',
      });
      expect(providerSettings.exportSettings).toHaveBeenCalledOnce();
      window.localStorage.removeItem('tmdbReadAccessToken');
      window.localStorage.removeItem('tmdbApiKey');
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
      imageStorage.parseExportedImages.mockResolvedValue([]);
      storageService.importDataWithImages.mockResolvedValue(undefined);

      await importExportService.importData(file);

      expect(imageStorage.parseExportedImages).toHaveBeenCalledWith([]);
      expect(storageService.importDataWithImages).toHaveBeenCalledWith({ a: 1 }, []);
    });

    it('imports portable data together with its parsed images', async () => {
      const exportedImages = [{ id: 'poster-1', type: 'image/png', data: 'base64-data' }];
      const parsedImages = [{ id: 'poster-1', blob: new Blob(['image'], { type: 'image/png' }) }];
      imageStorage.parseExportedImages.mockResolvedValue(parsedImages);
      storageService.importDataWithImages.mockResolvedValue(undefined);

      await importExportService.importData(
        mockFile(JSON.stringify({ data: { items: [] }, images: exportedImages })),
      );

      expect(imageStorage.parseExportedImages).toHaveBeenCalledWith(exportedImages);
      expect(storageService.importDataWithImages).toHaveBeenCalledWith({ items: [] }, parsedImages);
    });

    it('throws a friendly error for invalid JSON', async () => {
      const file = mockFile('not json');

      await expect(importExportService.importData(file)).rejects.toThrow('Invalid JSON file');
      expect(storageService.importDataWithImages).not.toHaveBeenCalled();
    });

    it('rethrows non-syntax errors from the storage service', async () => {
      const file = mockFile('{"a":1}');
      imageStorage.parseExportedImages.mockResolvedValue([]);
      storageService.importDataWithImages.mockRejectedValue(new Error('Storage busy'));

      await expect(importExportService.importData(file)).rejects.toThrow('Storage busy');
    });

    it('imports old portable export without preferences', async () => {
      const file = mockFile(JSON.stringify({ data: { items: [] }, images: [] }));
      imageStorage.parseExportedImages.mockResolvedValue([]);
      storageService.importDataWithImages.mockResolvedValue(undefined);

      await importExportService.importData(file);

      expect(providerSettings.importSettings).not.toHaveBeenCalled();
      expect(storageService.importDataWithImages).toHaveBeenCalledWith({ items: [] }, []);
    });

    it('imports legacy raw data without preferences', async () => {
      const raw = {
        schemaVersion: 9,
        lastModifiedAt: new Date().toISOString(),
        groups: {},
        items: {},
      };
      const file = mockFile(JSON.stringify(raw));
      imageStorage.parseExportedImages.mockResolvedValue([]);
      storageService.importDataWithImages.mockResolvedValue(undefined);

      await importExportService.importData(file);

      expect(providerSettings.importSettings).not.toHaveBeenCalled();
      expect(storageService.importDataWithImages).toHaveBeenCalledWith(raw, []);
    });

    it('restores providerSettings when preferences are present', async () => {
      const providerSettingsPayload = {
        tmdb: false,
        jikan: false,
        anilist: true,
        includeAdult: true,
        titlePreference: ['native', 'english', 'romaji'],
        adultDisplayMode: 'hide',
      };
      const payload = {
        data: { items: [] },
        images: [],
        preferences: { providerSettings: providerSettingsPayload },
      };
      const file = mockFile(JSON.stringify(payload));
      storageService.importDataWithImages.mockResolvedValue(undefined);
      imageStorage.parseExportedImages.mockResolvedValue([]);

      await importExportService.importData(file);

      expect(providerSettings.importSettings).toHaveBeenCalledWith(providerSettingsPayload);
      expect(storageService.importDataWithImages).toHaveBeenCalledWith({ items: [] }, []);
    });

    it('ignores invalid preferences without failing the import', async () => {
      const payload = {
        data: { items: [] },
        images: [],
        preferences: { providerSettings: { tmdb: 'bad', titlePreference: ['bad'] } },
      };
      const file = mockFile(JSON.stringify(payload));
      providerSettings.importSettings.mockImplementation(() => {
        throw new Error('invalid');
      });
      storageService.importDataWithImages.mockResolvedValue(undefined);
      imageStorage.parseExportedImages.mockResolvedValue([]);

      await expect(importExportService.importData(file)).resolves.toBeUndefined();
      expect(storageService.importDataWithImages).toHaveBeenCalledWith({ items: [] }, []);
      expect(providerSettings.importSettings).toHaveBeenCalled();
    });

    it('never imports sensitive tokens even if injected', async () => {
      const payload = {
        data: { items: [] },
        images: [],
        preferences: {
          providerSettings: {
            tmdb: true,
            jikan: true,
            anilist: true,
            includeAdult: false,
            titlePreference: ['romaji', 'english', 'native'],
            adultDisplayMode: 'show',
          },
          tmdbReadAccessToken: 'evil-token',
          tmdbApiKey: 'evil-key',
        },
      };
      const file = mockFile(JSON.stringify(payload));
      storageService.importDataWithImages.mockResolvedValue(undefined);
      imageStorage.parseExportedImages.mockResolvedValue([]);

      await importExportService.importData(file);

      expect(providerSettings.importSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          tmdb: true,
          includeAdult: false,
        }),
      );
      // importSettings should only receive providerSettings, never the injected token keys
      const calledWith = providerSettings.importSettings.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(calledWith).not.toHaveProperty('tmdbReadAccessToken');
      expect(calledWith).not.toHaveProperty('tmdbApiKey');
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
