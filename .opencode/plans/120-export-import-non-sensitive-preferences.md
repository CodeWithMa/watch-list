# Plan — Issue 120: Export/import non-sensitive preferences (S 1-2d)

> 3rd in sequence — completes "export → clear → import to new device" fidelity without leaking secrets.

## 1. Context & Why now

Users lose `providerSettings` (`tmdb`/`jikan`/`anilist` toggles + `includeAdult` + `adultDisplayMode` + `titlePreference`) on `export → clear storage → import` to a new device. Current `import-export.service.ts:12` only exports `{data, images}`; `provider-settings.service.ts:4` (`suggestionProviders` in `localStorage`) is left behind. Re-import therefore resets to defaults, which is especially painful for adult-filter and anime title-order customizations.

Sensitive creds `tmdb-settings.service.ts:3` (`tmdbReadAccessToken` / `tmdbApiKey` in `localStorage`) must **never** leave the device via export. Previous issues already hardened provider/adult/title prefs; this issue closes the portability gap.

Upstream priority: S (1–2d), ranked 3rd — after provider/adult work, before any theme/sort export.

---

## 2. Current state

### 2.1 `src/app/services/import-export.service.ts:12` + `:59`

```ts
// src/app/services/import-export.service.ts:12
async exportData(): Promise<void> {
  this.downloadJson(
    { data: this.storageService.getData(), images: await this.imageStorage.exportImages() },
    'watch-list-export',
  );
}
// src/app/services/import-export.service.ts:59
function isPortableExport(value: unknown): value is { data: unknown; images: unknown } {
  return !!value && typeof value === 'object' && 'data' in value && 'images' in value;
}
// src/app/services/import-export.service.ts:41
async importData(file: File): Promise<void> {
  const data = isPortableExport(payload) ? payload.data : payload;
  const images = await this.imageStorage.parseExportedImages(
    isPortableExport(payload) ? payload.images : [],
  );
  await this.storageService.importDataWithImages(data, images);
}
```

* Portable export detected by `data` + `images`. Legacy fallback: raw `StorageData` object imports as `data` with `images=[]`. Covered by `src/app/services/import-export.service.spec.ts:111`.

### 2.2 `src/app/services/provider-settings.service.ts`

* Single key `suggestionProviders` → `ProviderSettings` (`src/app/services/provider-settings.service.ts:32`):

```ts
export type ProviderSettings = Record<SuggestionSource, boolean> & {
  includeAdult: boolean;
  titlePreference: TitlePreference; // 3-tuple of 'romaji'|'english'|'native'
  adultDisplayMode: AdultDisplayMode; // 'show'|'blur'|'hide'
};
```

* `load():` validates/normalizes, `save():` persists, strict `normalizeTitlePreference` resets on any invalid entry. All writes go through `setEnabled`/`setIncludeAdult`/`setTitlePreference`/`setAdultDisplayMode`.
* Consumed in `tmdb-suggestion.service.ts:46`, `jikan-suggestion.service.ts:58`, `anilist-suggestion.service.ts:112`, plus `settings.component.ts:446`.

### 2.3 `src/app/services/tmdb-settings.service.ts:3`

* Keys `tmdbReadAccessToken` / `tmdbApiKey` — **sensitive**, `localStorage` only, signals `token`/`key`. Must be filtered — never written to export JSON, never read on import.

### 2.4 `src/app/components/settings/settings.component.ts:271` — Data Management

Template `src/app/components/settings/settings.component.ts:316` currently holds two blocks (Export Data / Import Data) + recovery backups list. No preferences toggle exists. Component already injects `ProviderSettingsService` (`:429`) and mirrors signals `tmdbEnabled`/`jikanEnabled`/`anilistEnabled`/`includeAdult`/`adultDisplayMode`/`titleOrder`.

---

## 3. Goals / Non-goals

**Goals**

* Export optionally includes non-sensitive preferences; import restores them atomically with existing data/images flow.
* Backward compat: old exports (no `preferences`) still import; new exports import on old code as `{data,images}` (extra key ignored) or via updated `isPortableExport`.
* Sensitive tokens never appear in exported file, even if `localStorage` is polluted.
* One checkbox in Data Management controls export inclusion (default: checked — preserves current pain).
* Tests prove no leakage + compat.

**Non-goals**

* Exporting `tmdb-settings.service.ts:3` tokens (explicitly excluded).
* Exporting theme (`theme.service.ts:21` / `src/index.html:12`), sort (`item-sort.service.ts:36`), or any other `localStorage` except `suggestionProviders`.
* Versioned migration for preferences shape — re-use existing `ProviderSettingsService.load()` normalization.
* Encrypting export — plaintext JSON remains.

---

## 4. Proposal

### 4.1 Payload extension — `import-export.service.ts:12`

New type, backward-compat:

```ts
// src/app/services/import-export.service.ts
export interface ExportPreferences {
  providerSettings: ProviderSettings; // exact shape from ProviderSettingsService
}
export interface PortableExport {
  data: unknown;              // StorageData (validated on import)
  images: ExportedImage[];    // existing
  preferences?: ExportPreferences; // NEW — optional
}
```

* `exportData(options?: { includePreferences?: boolean })` — when `includePreferences === true` (or default), read `ProviderSettingsService.settings()` via `structuredClone` and embed as `preferences.providerSettings`. When `false`, omit key entirely.
* `downloadJson` payload becomes `PortableExport` conditionally.
* Sensitive filter: **no code path reads `TmdbSettingsService` or `localStorage` keys `tmdbReadAccessToken`/`tmdbApiKey`** for export. Guard by code review + grep test.

### 4.2 Backward-compat detector — `isPortableExport:59`

Keep `isPortableExport` requiring only `data` + `images`; make `preferences` optional so old exports pass and new exports also pass on old code (which simply ignores unknown keys). Update type guard:

```ts
function isPortableExport(value: unknown): value is PortableExport {
  return !!value && typeof value === 'object' && 'data' in value && 'images' in value;
  // preferences intentionally NOT required
}
function hasPreferences(value: unknown): value is { preferences: ExportPreferences } {
  return !!value && typeof value === 'object' && 'preferences' in value;
}
```

Legacy raw-data fallback (`payload` without `data`/`images`) stays unchanged.

### 4.3 Import path — still `importData:41`

```ts
async importData(file: File): Promise<void> {
  const payload = JSON.parse(text);
  const data = isPortableExport(payload) ? payload.data : payload;
  const images = await this.imageStorage.parseExportedImages(
    isPortableExport(payload) ? payload.images : [],
  );
  await this.storageService.importDataWithImages(data, images);
  // NEW — after data success
  if (isPortableExport(payload) && hasPreferences(payload) && payload.preferences?.providerSettings) {
    this.applyProviderSettings(payload.preferences.providerSettings);
  }
}
```

* `applyProviderSettings(raw: unknown)` delegates to `ProviderSettingsService` validation — either by calling a new public `importSettings(raw)` that re-uses `load()`/`normalizeTitlePreference`/`normalizeAdultDisplayMode` logic, or by constructing a normalized `ProviderSettings` and calling existing setters (`setEnabled` x3, `setIncludeAdult`, `setTitlePreference`, `setAdultDisplayMode`). Prefer a single atomic `replaceSettings(normalized)` to avoid N `localStorage` writes.
* Invalid `preferences` → silently skip (or log warning), never throw — data import must succeed even if prefs corrupt.
* No import of sensitive keys: ignore any `tmdbReadAccessToken`/`tmdbApiKey` if present (defense in depth — strip if attacker injects).
* Behavior for `preferences === undefined` → no-op (old file).

**Import checkbox (optional, not required):** If UX wants import opt-in, add second checkbox "Apply imported preferences" default checked, visible only when `payload.preferences` present. This issue's spec says **export checkbox only** (`settings.component.ts:271`); keep import automatic for simplicity. Leave hook for future.

### 4.4 ProviderSettingsService change

Add import helper (keeps validation single-sourced):

```ts
// src/app/services/provider-settings.service.ts
importSettings(raw: unknown): void {
  // validate like load(), write iff valid
  // reuse existing load/normalize helpers, then this.enabled.set(normalized); this.save(normalized);
}
replaceSettings(settings: ProviderSettings): void { ... } // or reuse
```

Alternatively expose `exportSettings(): ProviderSettings` returning `clone(this.enabled())`. Minimal diff: make `load()` logic testable via `normalizeRaw()` extracted.

No schema version bump needed — preferences live outside `StorageData` (`src/app/domain/storage-schema.ts:73`).

### 4.5 UI — `settings.component.ts:271` Data Management

Insert checkbox above Export/Import, inside existing `bg-light-bg-tertiary` card:

```html
<!-- Data Management -->
<div class="mb-4">
  <label class="flex items-center gap-3 cursor-pointer">
    <input
      id="includePreferencesToggle"
      type="checkbox"
      [checked]="includePreferences()"
      (change)="includePreferences.set($any($event.target).checked)"
      class="w-5 h-5"
    />
    <span class="text-sm text-light-font dark:text-dark-font">
      Include preferences (providers, adult filter & display, title order)
    </span>
  </label>
  <p class="mt-1 text-xs text-light-font-secondary">TMDB tokens are never included.</p>
</div>
```

* Component state: `includePreferences = signal(true)` — default true matches "why now" pain; user can uncheck for clean share.
* Wire: `exportData()` → `this.importExportService.exportData({ includePreferences: this.includePreferences() })`.
* Import notice: after successful `importData`, if file contained preferences, surface `"Preferences restored"` alongside `"Data imported successfully"` or refresh signals (`tmdbEnabled`, `includeAdult`, …) via effect.
* A11y: `aria-label`, keyboard focus.

Alternative: put checkbox between Export button and Imports label — either works; keep close to Export action.

---

## 5. File changes (minimal)

| File | Change |
|------|--------|
| `src/app/services/import-export.service.ts:12` | Add `ExportPreferences`/`PortableExport` types, inject `ProviderSettingsService`, extend `exportData(options?)` to conditionally add `preferences`, extend `importData` to apply prefs, refactor `isPortableExport:59` + add `hasPreferences`/validation helpers, never touch `TmdbSettingsService`. |
| `src/app/services/provider-settings.service.ts` | Extract `normalizeRaw`/`importSettings` (reuses `normalizeTitlePreference:150`, `normalizeAdultDisplayMode:138`), add `exportSettings`/`replaceSettings` if needed. No storage key change. |
| `src/app/components/settings/settings.component.ts:271` | Add `includePreferences` signal, checkbox in Data Management (`:316`), pass flag to `exportData()`, refresh pref signals after import. |
| `src/app/components/settings/settings.component.ts` template | Checkbox markup + helper text noting tokens never exported. |
| `src/app/services/import-export.service.spec.ts` | New cases (see §7). |
| `src/app/components/settings/settings.component.spec.ts` | Checkbox + wiring tests. |
| `src/app/services/provider-settings.service.spec.ts` (new or existing) | import/normalize tests if new helper added. |

No `tmdb-settings.service.ts:3` change — only ensure it's **not imported** in export path.

---

## 6. Security — filter guarantee

* Static grep in CI/test: `rg -n "tmdbReadAccessToken|tmdbApiKey|TmdbSettingsService" src/app/services/import-export.service.ts` must be 0 matches for export path (allow `ProviderSettingsService` only).
* Runtime: `exportData` builds prefs by reading `ProviderSettingsService.settings()` — structurally cannot contain tokens. Even if `localStorage` has tokens, they live under different keys and are not read.
* Import defense: if incoming JSON contains `preferences.tmdbReadAccessToken` etc., `applyProviderSettings` strips unknown keys (only `tmdb/jikan/anilist/includeAdult/titlePreference/adultDisplayMode` allowed). Add explicit test feeding token-laden file.

---

## 7. Testing

### 7.1 `import-export.service.spec.ts` (extend `src/app/services/import-export.service.spec.ts:111`)

* **Old export still imports**: `mockFile(JSON.stringify({data:{items:[]}, images:[]}))` → `importDataWithImages` called, no pref side-effect.
* **Legacy raw data**: `'{"schemaVersion":9, "lastModifiedAt":..., "groups":{}, "items":{}}'` → `parseExportedImages([])` path.
* **New export without prefs omitted** (`includePreferences=false`) → blob lacks `preferences` key; grep verifies no `tmdbReadAccessToken`.
* **New export with prefs** → `{data, images, preferences:{providerSettings:{tmdb:true,...}}}` round-trips; `providerSettingsService.importSettings` called with exact normalized value.
* **Token never leaks** (core): seed `localStorage.setItem('tmdbReadAccessToken','secret')` + `tmdbApiKey`, call `exportData({includePreferences:true})`, assert serialized JSON `!includes('secret')` and `!includes('tmdbReadAccessToken')`.
* **Import applies prefs**: file with `preferences.providerSettings` containing custom `titlePreference:['native','english','romaji']` and `adultDisplayMode:'hide'` → service state reflects after `importData`.
* **Import invalid prefs is tolerant**: `{preferences:{providerSettings:{tmdb:"bad", titlePreference:["bad"]}}}` → data import succeeds, prefs fall back to defaults (via normalize), no throw.
* **Import with injected token**: `{..., preferences:{providerSettings:{...}, tmdbReadAccessToken:"evil"}}` → token ignored.

Use existing `mockDownload` helper (`:164`) + new `TestBed` provider for `ProviderSettingsService` mock.

### 7.2 `settings.component.spec.ts` (extend `src/app/components/settings/settings.component.spec.ts`)

* Checkbox renders in Data Management, default checked, `id="includePreferencesToggle"`.
* Toggling updates `includePreferences` signal.
* `exportData()` delegates `importExportService.exportData` with `{includePreferences:true/false}` matching toggle.
* After `onFileSelected` success with prefs-present file, component refreshes `tmdbEnabled/includeAdult/adultDisplayMode/titleOrder` signals (or `successMessage` mentions preferences).
* No regression for existing export/import success/failure cases (`:199`, `:264`).

### 7.3 Manual QA

* Export with checkbox checked → open JSON → confirm `preferences.providerSettings` present, no `tmdbReadAccessToken`/`tmdbApiKey`.
* Uncheck → export → confirm `preferences` absent.
* New device: `localStorage.clear()` → import old file → watch list restored, prefs stay default. Import new file → prefs restored, adult blur/hide and title order reflected immediately without reload.
* Build: `bun run test -- --no-watch`, `bun run lint`, `bun run build`.

---

## 8. Implementation steps (1–2d, S)

1. **Spec & types** (0.25d) — add `ExportPreferences`/`PortableExport`, design `ProviderSettingsService.importSettings` helper (extract normalize), update `isPortableExport:59` comment.
2. **ProviderSettingsService helpers** (0.25d) — `exportSettings()` / `importSettings(raw)` or `replaceSettings`; unit tests for normalization edge cases (`titlePreference` invalid → default).
3. **ImportExportService export** (0.25d) — inject service, `exportData({includePreferences})`, `downloadJson` with conditional spread, filter guarantee, tests.
4. **ImportExportService import** (0.25d) — `applyProviderSettings` with tolerant validation, legacy + token-injection tests.
5. **SettingsComponent UI** (0.25d) — `includePreferences` signal + checkbox at `:271`/`:316`, wiring to service, helper text; spec.
6. **Verification** (0.25d) — `bun run test -- --no-watch`, grep checks, manual export inspection, `isPortableExport` backward-compat matrix.

No DB migration; no `storage-schema.ts` change.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Extra `preferences` key breaks old app importing new file (unknown-key strict schema) | Old `isPortableExport` checks only `data`+`images`; `normalizeStorageData` ignores top-level keys — safe. Add test importing new export with old service mock. |
| Corrupt prefs corrupt entire import | Import prefs after `importDataWithImages` success, isolated try/catch; data import always wins. |
| User confused by auto-applying prefs on import (may overwrite intentional local prefs) | Checkbox defaults true handles pain; optionally add import-time confirm or second toggle later — keep decision reversible. Document behavior. |
| Title preference strict reset surprises user | Reuses existing `normalizeTitlePreference:150` contract (any invalid → default). Existing behavior, not new. |
| Accidentally exporting tokens via generic `localStorage` dump | Prohibit `localStorage` iteration in export; only read typed `ProviderSettingsService.settings()`. Add spec asserting no `TmdbSettingsService` import. |

---

## 10. Alternatives considered

* **Include `theme`/`sort` in same payload** — deferred; scope creep, not requested in issue, separate discussion per preference tier.
* **Encode prefs inside `data` (StorageData)** — rejected; pollutes schema version, forces migration, couples preferences to item storage. Top-level `preferences` keeps concerns separate.
* **Versioned export envelope `{version:1, data, images, preferences}`** — overkill; optional `preferences` field already versionless-compatible. Add `exportVersion` later if envelope needed.
* **Lenient titlePreference dedup instead of strict reset** (`provider-settings.service.ts:148`) — kept strict per existing decision comment.

---

## 11. Acceptance criteria (must pass before merge)

* [ ] `exportData({includePreferences:true})` JSON contains `preferences.providerSettings` with current `tmdb/jikan/anilist/includeAdult/adultDisplayMode/titlePreference`; never contains `tmdbReadAccessToken`/`tmdbApiKey` or token values.
* [ ] `exportData({includePreferences:false})` JSON has no `preferences` key.
* [ ] Data Management shows checkbox `include preferences` (checked by default) next to Export; unchecked export omits prefs.
* [ ] Import of old file (no `preferences`, or raw `StorageData`) still succeeds; prefs unchanged.
* [ ] Import of new file restores prefs (validated/normalized) after `importDataWithImages` succeeds.
* [ ] Unit tests: compat + no-leak + invalid-prefs-tolerant + token-injection-ignored.
* [ ] `bun run test -- --no-watch` and `bun run build` green.

---

## 12. Open questions

* Import checkbox wanted? Issue text says "Add checkbox in `settings.component.ts:271` Data Management." Singular likely means export inclusion only. Confirm with reviewer whether import-side opt-in ("Apply imported preferences") is also desired — trivial to add if needed, default checked.
* Default for export checkbox: `true` (preserve behavior, fix pain) vs `false` (opt-in privacy). Decision here: `true` with explicit helper text that tokens never export.
