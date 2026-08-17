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
      testIgnore: /dialog-focus-trap\.guest\.spec\.ts$/,
      use: { browserName: 'chromium', viewport: MOBILE_VIEWPORT },
    },
    {
      // `dialog-focus-trap.guest.spec.ts` logs in with the shared seeded
      // admin account itself (rather than reusing `mobile-authenticated`'s
      // storageState) so it doesn't depend on that project's captured
      // refresh-token cookie directly. But the backend's refresh-rotation
      // reuse-detection revokes ALL of a user's active sessions on a
      // detected collision — not just the reused one — so *any* concurrent
      // admin login/refresh (this test's own, or `mobile-authenticated`'s)
      // can still revoke this test's freshly-issued session mid-run.
      // Sequencing this project after the others via `dependencies` avoids
      // that overlap instead of trying to make concurrent admin sessions
      // safe, which is outside this change's scope.
      name: 'mobile-focus-trap',
      testMatch: /dialog-focus-trap\.guest\.spec\.ts$/,
      dependencies: ['mobile-authenticated', 'mobile-guest'],
      use: { browserName: 'chromium', viewport: MOBILE_VIEWPORT },
    },
  ],
});
