import { TmdbSettingsService } from './tmdb-settings.service';

describe('TmdbSettingsService', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        clear() {
          Object.keys(store).forEach((key) => delete store[key]);
        },
        getItem(key: string) {
          return store[key] ?? null;
        },
        setItem(key: string, value: string) {
          store[key] = value;
        },
        removeItem(key: string) {
          delete store[key];
        },
      },
      writable: true,
    });
  });

  it('saves trimmed credentials locally', () => {
    const service = new TmdbSettingsService();

    service.saveCredentials('  token-value  ', '  api-key-value  ');

    expect(service.token()).toBe('token-value');
    expect(service.key()).toBe('api-key-value');
    expect(localStorage.getItem('tmdbReadAccessToken')).toBe('token-value');
    expect(localStorage.getItem('tmdbApiKey')).toBe('api-key-value');
    expect(localStorage.getItem('watchListData')).toBeNull();
  });

  it('clears credentials when saved values are blank', () => {
    const service = new TmdbSettingsService();

    service.saveCredentials('token-value', 'api-key-value');
    service.saveCredentials('   ', '   ');

    expect(service.token()).toBe('');
    expect(service.key()).toBe('');
    expect(localStorage.getItem('tmdbReadAccessToken')).toBeNull();
    expect(localStorage.getItem('tmdbApiKey')).toBeNull();
  });

  it('clears existing credentials', () => {
    const service = new TmdbSettingsService();

    service.saveCredentials('token-value', 'api-key-value');
    service.clearCredentials();

    expect(service.token()).toBe('');
    expect(service.key()).toBe('');
    expect(localStorage.getItem('tmdbReadAccessToken')).toBeNull();
    expect(localStorage.getItem('tmdbApiKey')).toBeNull();
  });

  it('prefers the read access token when both credentials exist', () => {
    const service = new TmdbSettingsService();

    service.saveCredentials('token-value', 'api-key-value');

    expect(service.getCredential()).toEqual({ type: 'read-token', value: 'token-value' });
  });

  it('falls back to the API key when no read access token exists', () => {
    const service = new TmdbSettingsService();

    service.saveCredentials('', 'api-key-value');

    expect(service.getCredential()).toEqual({ type: 'api-key', value: 'api-key-value' });
  });
});
