import { defineConfig, devices } from '@playwright/test';

// Set E2E_BASE_URL to test an already running deployment (CI points it at the
// nginx container, the only place the real security headers exist). Without it
// the production build is created and served locally.
const externalBaseUrl = process.env['E2E_BASE_URL'];
const localPort = 4300;
// Playwright's downloaded Chromium cannot start on every OS (NixOS, for one).
// Set E2E_CHROMIUM_PATH to use a system browser instead.
const executablePath = process.env['E2E_CHROMIUM_PATH'];

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: !!process.env['CI'],
  reporter: 'list',
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${localPort}`,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `bun run build && bun e2e/serve.mjs ${localPort}`,
        url: `http://localhost:${localPort}`,
        timeout: 180_000,
        reuseExistingServer: false,
      },
});
