import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ImportExportService } from '../../services/import-export.service';
import { TmdbCredential, TmdbSettingsService } from '../../services/tmdb-settings.service';
import { ProviderSettingsService } from '../../services/provider-settings.service';
import { NormalizationReport, createDefaultStorageData } from '../../domain/storage-schema';
import { SettingsComponent } from './settings.component';
import { vi, afterEach, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { StorageService } from '../../services/storage.service';
import { CURRENT_SCHEMA_VERSION } from '../../models/storage.model';

const CLEAN_IMPORT: NormalizationReport = {
  dropped: { groups: 0, items: 0, deletedItems: 0 },
  repairedGroupReferences: 0,
};

describe('SettingsComponent', () => {
  let origHash: string;
  let origVersion: string;
  let origBuildDate: string;

  beforeEach(() => {
    origHash = environment.commitHash;
    origVersion = environment.appVersion;
    origBuildDate = environment.buildDate;
    // jsdom does not implement window.focus; stub it (restored in afterEach).
    vi.spyOn(window, 'focus').mockReturnValue(undefined);
  });

  afterEach(() => {
    environment.commitHash = origHash;
    environment.appVersion = origVersion;
    environment.buildDate = origBuildDate;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function configure(credentials: { token: string; key: string; credential: TmdbCredential }) {
    const tmdbSettingsService = {
      token: vi.fn(() => credentials.token),
      key: vi.fn(() => credentials.key),
      getCredential: vi.fn(() => credentials.credential),
      saveCredentials: vi.fn(),
      clearCredentials: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ImportExportService,
          useValue: {
            exportData: vi.fn(),
            getRecoveryBackups: vi.fn().mockResolvedValue([]),
            exportRecoveryBackup: vi.fn().mockResolvedValue(undefined),
            importData: vi.fn().mockResolvedValue(CLEAN_IMPORT),
          },
        },
        {
          provide: TmdbSettingsService,
          useValue: tmdbSettingsService,
        },
      ],
    });

    return tmdbSettingsService;
  }

  it('keeps a clear explanation visible when an import requires a newer app version', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: new IDBFactory(),
    });
    const storage = TestBed.inject(StorageService);
    await storage.initialize();
    const original = storage.getData();
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const file = new File([], 'newer-export.json');
    Object.defineProperty(file, 'text', {
      value: async () =>
        JSON.stringify({
          ...original,
          schemaVersion: CURRENT_SCHEMA_VERSION + 1,
          futureSettings: { layout: 'timeline' },
        }),
    });
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    const invalid = new File([], 'invalid.json');
    Object.defineProperty(invalid, 'text', { value: async () => 'not JSON' });
    Object.defineProperty(input, 'files', { value: [invalid], configurable: true });
    input.dispatchEvent(new Event('change'));
    vi.useFakeTimers();
    await fixture.componentInstance.confirmImport();
    expect(fixture.componentInstance.errorMessage()).toContain('Invalid JSON file');
    vi.advanceTimersByTime(1000);
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));

    await fixture.componentInstance.confirmImport();
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Import failed:');
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'newer version of Watch List',
    );
    expect(root.textContent).toContain('No data was changed.');
    expect(storage.getData()).toEqual(original);
    vi.advanceTimersByTime(5001);
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'newer version of Watch List',
    );
    expect(fixture.componentInstance.successMessage()).toBeNull();
    expect(fixture.componentInstance.importInProgress()).toBe(false);
  });

  it('does not show a TMDB status message on initial load with saved credentials', async () => {
    configure({
      token: 'read-token',
      key: 'api-key',
      credential: { type: 'read-token', value: 'read-token' },
    });
    const fixture = TestBed.createComponent(SettingsComponent);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.tmdbSettingsMessage()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('TMDB read access token saved');
  });

  it('shows TMDB logo attribution', async () => {
    configure({
      token: '',
      key: '',
      credential: null,
    });
    const fixture = TestBed.createComponent(SettingsComponent);

    fixture.detectChanges();
    await fixture.whenStable();

    const logo = fixture.nativeElement.querySelector('img[alt="TMDB"]') as HTMLImageElement;
    const link = fixture.nativeElement.querySelector(
      'a[href="https://www.themoviedb.org"]',
    ) as HTMLAnchorElement;

    expect(logo).toBeDefined();
    expect(logo.src).toContain('/assets/2/v4/logos/v2/blue_square_2-');
    expect(link).toBeDefined();
    expect(fixture.nativeElement.textContent).toContain(
      'This product uses the TMDB API but is not endorsed or certified by TMDB.',
    );
  });

  it('shows a TMDB status message after saving credentials', () => {
    const tmdbSettingsService = configure({
      token: 'read-token',
      key: 'api-key',
      credential: { type: 'read-token', value: 'read-token' },
    });
    const fixture = TestBed.createComponent(SettingsComponent);

    fixture.componentInstance.saveTmdbToken();

    expect(tmdbSettingsService.saveCredentials).toHaveBeenCalledWith('read-token', 'api-key');
    expect(fixture.componentInstance.tmdbSettingsMessage()).toBe(
      'TMDB read access token saved and will be used first.',
    );
  });

  it('shows a TMDB status message after clearing credentials', () => {
    const tmdbSettingsService = configure({
      token: 'read-token',
      key: 'api-key',
      credential: { type: 'read-token', value: 'read-token' },
    });
    const fixture = TestBed.createComponent(SettingsComponent);

    fixture.componentInstance.clearTmdbToken();

    expect(tmdbSettingsService.clearCredentials).toHaveBeenCalled();
    expect(fixture.componentInstance.tmdbSettingsMessage()).toBe('TMDB credentials cleared.');
  });

  it('shows recovery backup export feedback on success', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    const fixture = TestBed.createComponent(SettingsComponent);

    await fixture.componentInstance.exportRecoveryBackup('watch-list-data-backup-123');

    expect(exportService.exportRecoveryBackup).toHaveBeenCalledWith('watch-list-data-backup-123');
    expect(fixture.componentInstance.successMessage()).toBe(
      'Recovery backup exported successfully',
    );
    expect(fixture.componentInstance.errorMessage()).toBeNull();
  });

  it('shows recovery backup export feedback on failure', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    vi.spyOn(exportService, 'exportRecoveryBackup').mockRejectedValue(
      new Error('No recovery backup'),
    );
    const fixture = TestBed.createComponent(SettingsComponent);

    await fixture.componentInstance.exportRecoveryBackup('watch-list-data-backup-123');

    expect(exportService.exportRecoveryBackup).toHaveBeenCalledWith('watch-list-data-backup-123');
    expect(fixture.componentInstance.errorMessage()).toBe('No recovery backup');
    expect(fixture.componentInstance.successMessage()).toBeNull();
  });

  it('hides recovery backups section when no backups exist', async () => {
    configure({ token: '', key: '', credential: null });
    const fixture = TestBed.createComponent(SettingsComponent);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).not.toContain('Recovery Backups');
  });

  it('shows recovery backups section when backups exist', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    vi.spyOn(exportService, 'getRecoveryBackups').mockResolvedValue([
      { key: 'watch-list-data-backup-1234567890', timestamp: new Date('2026-01-15T10:30:00.000Z') },
      { key: 'watch-list-data-backup-1234567800', timestamp: new Date('2026-01-14T09:00:00.000Z') },
    ]);
    const fixture = TestBed.createComponent(SettingsComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Recovery Backups');
    expect(fixture.nativeElement.textContent).toContain('Download');
  });

  it('shows the API key fallback message after saving only an API key', () => {
    configure({
      token: '',
      key: 'api-key',
      credential: { type: 'api-key', value: 'api-key' },
    });
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.componentInstance.tmdbToken.set('');
    fixture.componentInstance.tmdbApiKey.set('api-key');

    fixture.componentInstance.saveTmdbToken();

    expect(fixture.componentInstance.tmdbSettingsMessage()).toBe(
      'TMDB API key saved and will be used as fallback.',
    );
  });

  it('shows success feedback when exporting data', async () => {
    vi.useFakeTimers();
    configure({ token: '', key: '', credential: null });
    let resolveExport!: () => void;
    const exportService = TestBed.inject(ImportExportService);
    vi.spyOn(exportService, 'exportData').mockReturnValue(
      new Promise<void>((resolve) => {
        resolveExport = resolve;
      }),
    );
    const fixture = TestBed.createComponent(SettingsComponent);

    const exporting = fixture.componentInstance.exportData();

    expect(fixture.componentInstance.successMessage()).toBeNull();
    resolveExport();
    await exporting;

    expect(fixture.componentInstance.successMessage()).toBe('Data exported successfully');
    expect(fixture.componentInstance.errorMessage()).toBeNull();
  });

  it('shows an error when exporting data fails', () => {
    vi.useFakeTimers();
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    vi.spyOn(exportService, 'exportData').mockImplementation(() => {
      throw new Error('Disk full');
    });
    const fixture = TestBed.createComponent(SettingsComponent);

    fixture.componentInstance.exportData();

    expect(fixture.componentInstance.errorMessage()).toBe('Failed to export data');
  });

  it('does nothing when no file is selected', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    const fixture = TestBed.createComponent(SettingsComponent);
    const target = { files: null as FileList | null, value: '' };

    await fixture.componentInstance.onFileSelected({ target } as unknown as Event);

    expect(exportService.importData).not.toHaveBeenCalled();
  });

  it('opens the file picker exactly once from a keyboard-focusable Import Data button', () => {
    configure({ token: '', key: '', credential: null });
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.trim() === 'Import Data',
    ) as HTMLButtonElement | undefined;
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('type')).toBe('button');
    // The file input must not be nested in a label: label activation plus an
    // explicit .click() would open the picker twice.
    expect(
      fixture.nativeElement.querySelector('label input[type="file"][accept=".json"]'),
    ).toBeNull();

    const input = fixture.nativeElement.querySelector(
      'input[type="file"][accept=".json"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click').mockReturnValue(undefined);
    button?.click();

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('requests window focus and stages the selected import from the file input', async () => {
    configure({ token: '', key: '', credential: null });
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['{}'], 'export.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();

    expect(window.focus).toHaveBeenCalledOnce();
    expect(root.textContent).toContain('Import "export.json"?');
    expect(TestBed.inject(ImportExportService).importData).not.toHaveBeenCalled();
  });

  it.each(['change', 'cancel'])(
    'requests window focus on %s with no file without staging or importing data',
    async (event) => {
      configure({ token: '', key: '', credential: null });
      const fixture = TestBed.createComponent(SettingsComponent);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
      input.dispatchEvent(new Event(event, { bubbles: true }));
      await fixture.whenStable();

      expect(window.focus).toHaveBeenCalledOnce();
      expect(root.textContent).not.toContain('Confirm Import');
      expect(TestBed.inject(ImportExportService).importData).not.toHaveBeenCalled();
    },
  );

  it('runs only one import when confirm is triggered twice while in progress', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    let resolveImport!: (value: NormalizationReport) => void;
    vi.mocked(exportService.importData).mockReturnValue(
      new Promise<NormalizationReport>((resolve) => {
        resolveImport = resolve;
      }),
    );
    const fixture = TestBed.createComponent(SettingsComponent);
    const target = {
      files: [
        new File(['{"a":1}'], 'export.json', { type: 'application/json' }),
      ] as unknown as FileList,
      value: '',
    };

    await fixture.componentInstance.onFileSelected({ target } as unknown as Event);
    const first = fixture.componentInstance.confirmImport();
    expect(fixture.componentInstance.importInProgress()).toBe(true);
    fixture.detectChanges();

    const confirmButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.trim() === 'Confirm Import',
    ) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    await fixture.componentInstance.confirmImport();
    resolveImport(CLEAN_IMPORT);
    await first;

    expect(exportService.importData).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.importInProgress()).toBe(false);
    expect(fixture.componentInstance.pendingImportFile()).toBeNull();
  });

  it('keeps a file selected during an import pending after the import finishes', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    let resolveFirst!: (value: NormalizationReport) => void;
    vi.mocked(exportService.importData)
      .mockReturnValueOnce(
        new Promise<NormalizationReport>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValue(CLEAN_IMPORT);
    const fixture = TestBed.createComponent(SettingsComponent);
    const pick = (name: string) => ({
      files: [new File(['{}'], name, { type: 'application/json' })] as unknown as FileList,
      value: '',
    });

    await fixture.componentInstance.onFileSelected({ target: pick('a.json') } as unknown as Event);
    const first = fixture.componentInstance.confirmImport();
    expect(fixture.componentInstance.importInProgress()).toBe(true);
    fixture.detectChanges();

    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    const byText = (text: string) => buttons.find((button) => button.textContent?.trim() === text);
    expect(byText('Import Data')?.disabled).toBe(true);
    expect(byText('Cancel')?.disabled).toBe(true);

    // The picker is disabled while importing, but a file staged meanwhile
    // must not be discarded by the running import's cleanup.
    await fixture.componentInstance.onFileSelected({ target: pick('b.json') } as unknown as Event);
    await fixture.componentInstance.confirmImport();
    expect(exportService.importData).toHaveBeenCalledOnce();

    resolveFirst(CLEAN_IMPORT);
    await first;

    expect(fixture.componentInstance.importInProgress()).toBe(false);
    expect(fixture.componentInstance.pendingImportFile()?.name).toBe('b.json');

    await fixture.componentInstance.confirmImport();

    expect(exportService.importData).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.pendingImportFile()).toBeNull();
  });

  it('stages the import on file select and imports only after confirmation', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    const fixture = TestBed.createComponent(SettingsComponent);
    const target = {
      files: [
        new File(['{"a":1}'], 'export.json', { type: 'application/json' }),
      ] as unknown as FileList,
      value: 'previous-file.json',
    };

    await fixture.componentInstance.onFileSelected({ target } as unknown as Event);

    expect(exportService.importData).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pendingImportFile()?.name).toBe('export.json');
    expect(target.value).toBe('');

    await fixture.componentInstance.confirmImport();

    expect(exportService.importData).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.pendingImportFile()).toBeNull();
    expect(fixture.componentInstance.successMessage()).toBe('Data imported successfully');
  });

  it('aborts the import when the user cancels the inline confirmation', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    const fixture = TestBed.createComponent(SettingsComponent);
    const target = {
      files: [
        new File(['{"a":1}'], 'export.json', { type: 'application/json' }),
      ] as unknown as FileList,
      value: 'previous-file.json',
    };

    await fixture.componentInstance.onFileSelected({ target } as unknown as Event);
    fixture.componentInstance.cancelImport();
    await fixture.componentInstance.confirmImport();

    expect(exportService.importData).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pendingImportFile()).toBeNull();
    expect(target.value).toBe('');
  });

  it('shows success feedback after a confirmed import', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    const fixture = TestBed.createComponent(SettingsComponent);
    const target = {
      files: [
        new File(['{"a":1}'], 'export.json', { type: 'application/json' }),
      ] as unknown as FileList,
      value: '',
    };

    await fixture.componentInstance.onFileSelected({ target } as unknown as Event);
    await fixture.componentInstance.confirmImport();

    expect(exportService.importData).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.successMessage()).toBe('Data imported successfully');
    expect(fixture.componentInstance.errorMessage()).toBeNull();
  });

  it('reports omitted records instead of a plain success message', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    vi.mocked(exportService.importData).mockResolvedValue({
      dropped: { groups: 1, items: 2, deletedItems: 0 },
      repairedGroupReferences: 0,
    });
    const fixture = TestBed.createComponent(SettingsComponent);
    const target = {
      files: [
        new File(['{"a":1}'], 'export.json', { type: 'application/json' }),
      ] as unknown as FileList,
      value: '',
    };

    await fixture.componentInstance.onFileSelected({ target } as unknown as Event);
    await fixture.componentInstance.confirmImport();

    expect(fixture.componentInstance.successMessage()).toBe(
      'Import completed with 3 invalid record(s) omitted.',
    );
    expect(fixture.componentInstance.errorMessage()).toBeNull();
  });

  it.each([false, true])(
    'reports repaired references in a real import (also omitted: %s)',
    async (omit) => {
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: new IDBFactory(),
      });
      const storage = TestBed.inject(StorageService);
      await storage.initialize();
      const fixture = TestBed.createComponent(SettingsComponent);
      fixture.detectChanges();
      const movie = {
        id: 'movie',
        title: 'Movie',
        type: 'movie',
        status: 'completed',
        isAdult: false,
        groupId: 'missing',
        createdAt: '2026-01-01',
        watchHistory: [],
      };
      const payload = {
        ...createDefaultStorageData(),
        items: { movie, ...(omit ? { bad: { ...movie, id: 'bad', title: ' ' } } : {}) },
      };
      const file = new File([], 'recovery.json');
      Object.defineProperty(file, 'text', { value: async () => JSON.stringify(payload) });
      const target = { files: [file], value: '' };

      await fixture.componentInstance.onFileSelected({ target } as unknown as Event);
      await fixture.componentInstance.confirmImport();
      fixture.detectChanges();

      const expected = omit
        ? 'Import completed with 1 invalid record(s) omitted and 1 missing group reference(s) repaired to Ungrouped.'
        : 'Import completed with 1 missing group reference(s) repaired to Ungrouped.';
      expect(fixture.componentInstance.successMessage()).toBe(expected);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(expected);
      expect(storage.getData().items['movie'].groupId).toBe('ungrouped');
      expect(Object.keys(storage.getData().items)).toEqual(['movie']);
    },
  );

  it('shows an error message when a confirmed import fails', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    vi.spyOn(exportService, 'importData').mockRejectedValue(new Error('Invalid JSON file'));
    const fixture = TestBed.createComponent(SettingsComponent);
    const target = {
      files: [
        new File(['not json'], 'export.json', { type: 'application/json' }),
      ] as unknown as FileList,
      value: '',
    };

    await fixture.componentInstance.onFileSelected({ target } as unknown as Event);
    await fixture.componentInstance.confirmImport();

    expect(fixture.componentInstance.errorMessage()).toBe('Import failed: Invalid JSON file');
    expect(fixture.componentInstance.successMessage()).toBeNull();
  });

  it('keeps a repeated import failure visible for five seconds after the latest failure', async () => {
    vi.useFakeTimers();
    configure({ token: '', key: '', credential: null });
    vi.mocked(TestBed.inject(ImportExportService).importData).mockRejectedValue(
      new Error('Invalid JSON file'),
    );
    const component = TestBed.createComponent(SettingsComponent).componentInstance;
    const file = new File(['invalid'], 'invalid.json');

    component.pendingImportFile.set(file);
    await component.confirmImport();
    vi.advanceTimersByTime(4000);
    component.pendingImportFile.set(file);
    await component.confirmImport();
    vi.advanceTimersByTime(1000);

    expect(component.errorMessage()).toBe('Import failed: Invalid JSON file');
    vi.advanceTimersByTime(3999);
    expect(component.errorMessage()).toBe('Import failed: Invalid JSON file');
    vi.advanceTimersByTime(1);
    expect(component.errorMessage()).toBeNull();
  });

  it('clears recovery backups when loading them fails', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    vi.spyOn(exportService, 'getRecoveryBackups').mockRejectedValue(new Error('Storage busy'));
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.componentInstance.recoveryBackups.set([{ key: 'backup1', timestamp: new Date() }]);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.recoveryBackups()).toEqual([]);
    expect(fixture.componentInstance.errorMessage()).toBeNull();
  });

  it('renders About section with version and linked commit hash', () => {
    environment.commitHash = 'abc123456789';
    environment.appVersion = '1.2.3';
    environment.buildDate = '2026-08-29T10:00:16.000Z';

    configure({
      token: '',
      key: '',
      credential: null,
    });
    const fixture = TestBed.createComponent(SettingsComponent);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Watch List v1.2.3');
    expect(fixture.nativeElement.textContent).toContain('abc1234');
    const link = fixture.nativeElement.querySelector(
      'a[href="https://github.com/CodeWithMa/watch-list/commit/abc123456789"]',
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.textContent).toContain('abc1234');
  });

  it('renders About section without link when commit is unknown', () => {
    environment.commitHash = 'unknown';
    environment.appVersion = 'unknown';
    environment.buildDate = 'unknown';

    configure({
      token: '',
      key: '',
      credential: null,
    });
    const fixture = TestBed.createComponent(SettingsComponent);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Watch List vunknown');
    expect(fixture.nativeElement.textContent).toContain('unknown');
    const link = fixture.nativeElement.querySelector(
      'a[href*="github.com/CodeWithMa/watch-list/commit"]',
    );
    expect(link).toBeNull();
  });

  it('places About section at the bottom of the page', () => {
    environment.commitHash = 'abc123456789';
    environment.appVersion = '1.2.3';
    environment.buildDate = '2026-08-29T10:00:16.000Z';

    configure({
      token: '',
      key: '',
      credential: null,
    });
    const fixture = TestBed.createComponent(SettingsComponent);

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text.lastIndexOf('About')).toBeGreaterThan(text.lastIndexOf('Data Management'));
  });

  it('renders About section with build date', () => {
    environment.commitHash = 'abc123456789';
    environment.appVersion = '1.2.3';
    environment.buildDate = '2026-08-29T10:00:16.000Z';

    configure({
      token: '',
      key: '',
      credential: null,
    });
    const fixture = TestBed.createComponent(SettingsComponent);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('— Built');
    // DatePipe 'medium' formats ISO to locale string containing year and month
    expect(fixture.nativeElement.textContent).toContain('2026');
    expect(fixture.nativeElement.textContent).toContain('Aug');
  });

  it('renders About section with unknown build date', () => {
    environment.commitHash = 'abc123456789';
    environment.appVersion = '1.2.3';
    environment.buildDate = 'unknown';

    configure({
      token: '',
      key: '',
      credential: null,
    });
    const fixture = TestBed.createComponent(SettingsComponent);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('— Built');
    expect(fixture.nativeElement.textContent).toContain('unknown');
  });

  it('syncs provider signals after successful import', async () => {
    const providerMock = {
      isEnabled: vi.fn().mockReturnValue(false),
      isAdultIncluded: vi.fn().mockReturnValue(false),
      getAdultDisplayMode: vi.fn().mockReturnValue('blur' as const),
      getTitlePreference: vi.fn().mockReturnValue(['romaji', 'english', 'native'] as const),
    };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ImportExportService,
          useValue: {
            exportData: vi.fn(),
            getRecoveryBackups: vi.fn().mockResolvedValue([]),
            exportRecoveryBackup: vi.fn().mockResolvedValue(undefined),
            importData: vi.fn().mockResolvedValue(CLEAN_IMPORT),
          },
        },
        {
          provide: TmdbSettingsService,
          useValue: {
            token: vi.fn(() => ''),
            key: vi.fn(() => ''),
            getCredential: vi.fn(() => null),
            saveCredentials: vi.fn(),
            clearCredentials: vi.fn(),
          },
        },
        { provide: ProviderSettingsService, useValue: providerMock },
      ],
    });
    const exportService = TestBed.inject(ImportExportService);
    const fixture = TestBed.createComponent(SettingsComponent);
    expect(fixture.componentInstance.includeAdult()).toBe(false);

    // Simulate import changing provider settings on disk
    providerMock.isAdultIncluded.mockReturnValue(true);
    providerMock.isEnabled.mockReturnValue(true);
    providerMock.getAdultDisplayMode.mockReturnValue('hide' as const);
    providerMock.getTitlePreference.mockReturnValue(['native', 'english', 'romaji'] as const);

    const target = {
      files: [
        new File(['{"a":1}'], 'export.json', { type: 'application/json' }),
      ] as unknown as FileList,
      value: '',
    };
    await fixture.componentInstance.onFileSelected({ target } as unknown as Event);
    await fixture.componentInstance.confirmImport();
    expect(exportService.importData).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.includeAdult()).toBe(true);
    expect(fixture.componentInstance.tmdbEnabled()).toBe(true);
    expect(fixture.componentInstance.adultDisplayMode()).toBe('hide');
    expect(fixture.componentInstance.titleOrder()).toEqual(['native', 'english', 'romaji']);
    expect(fixture.componentInstance.successMessage()).toBe('Data imported successfully');
  });
});
