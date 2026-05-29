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
        }
      },
      writable: true
    });
  });

  it('saves a trimmed read access token locally', () => {
    const service = new TmdbSettingsService();

    service.saveToken('  token-value  ');

    expect(service.token()).toBe('token-value');
    expect(localStorage.getItem('tmdbReadAccessToken')).toBe('token-value');
    expect(localStorage.getItem('watchListData')).toBeNull();
  });

  it('clears the token when saved value is blank', () => {
    const service = new TmdbSettingsService();

    service.saveToken('token-value');
    service.saveToken('   ');

    expect(service.token()).toBe('');
    expect(localStorage.getItem('tmdbReadAccessToken')).toBeNull();
  });

  it('clears an existing token', () => {
    const service = new TmdbSettingsService();

    service.saveToken('token-value');
    service.clearToken();

    expect(service.token()).toBe('');
    expect(localStorage.getItem('tmdbReadAccessToken')).toBeNull();
  });
});
