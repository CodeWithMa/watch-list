import { TestBed } from '@angular/core/testing';
import { ImportExportService } from '../../services/import-export.service';
import { TmdbCredential, TmdbSettingsService } from '../../services/tmdb-settings.service';
import { SettingsComponent } from './settings.component';
import { vi, afterEach } from 'vitest';

describe('SettingsComponent', () => {
  afterEach(() => {
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
            importData: vi.fn(),
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
    const fixture = TestBed.createComponent(SettingsComponent);

    await fixture.componentInstance.exportData();

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

  it('aborts the import when the user cancels the confirmation', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = TestBed.createComponent(SettingsComponent);
    const target = {
      files: [
        new File(['{"a":1}'], 'export.json', { type: 'application/json' }),
      ] as unknown as FileList,
      value: 'previous-file.json',
    };

    await fixture.componentInstance.onFileSelected({ target } as unknown as Event);

    expect(exportService.importData).not.toHaveBeenCalled();
    expect(target.value).toBe('');
  });

  it('shows success feedback after a confirmed import', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(SettingsComponent);
    const target = {
      files: [
        new File(['{"a":1}'], 'export.json', { type: 'application/json' }),
      ] as unknown as FileList,
      value: '',
    };

    await fixture.componentInstance.onFileSelected({ target } as unknown as Event);

    expect(exportService.importData).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.successMessage()).toBe('Data imported successfully');
    expect(fixture.componentInstance.errorMessage()).toBeNull();
  });

  it('shows an error message when a confirmed import fails', async () => {
    configure({ token: '', key: '', credential: null });
    const exportService = TestBed.inject(ImportExportService);
    vi.spyOn(exportService, 'importData').mockRejectedValue(new Error('Invalid JSON file'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(SettingsComponent);
    const target = {
      files: [
        new File(['not json'], 'export.json', { type: 'application/json' }),
      ] as unknown as FileList,
      value: '',
    };

    await fixture.componentInstance.onFileSelected({ target } as unknown as Event);

    expect(fixture.componentInstance.errorMessage()).toBe('Import failed: Invalid JSON file');
    expect(fixture.componentInstance.successMessage()).toBeNull();
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
});
