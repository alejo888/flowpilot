import { defineConfig } from '@playwright/test';
import path from 'node:path';

// A fixed mobile-ish viewport on chromium rather than the `devices['iPhone
// SE']` preset — that preset pins WebKit, and this suite only needs one
// consistent narrow width to catch layout overflow, not real device parity.
const MOBILE_VIEWPORT = { width: 375, height: 667 };

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-authenticated',
      testMatch: /\.authenticated\.spec\.ts$/,
      use: {
        browserName: 'chromium',
        viewport: MOBILE_VIEWPORT,
        storageState: path.join(__dirname, 'e2e/.auth/admin.json'),
      },
    },
    {
      name: 'mobile-guest',
      testMatch: /\.guest\.spec\.ts$/,
      use: { browserName: 'chromium', viewport: MOBILE_VIEWPORT },
    },
  ],
});
