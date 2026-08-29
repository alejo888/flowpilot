import { chromium, firefox, webkit, request, type BrowserType } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from './admin-session';

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost';
// WebKit refuses to send `Secure` cookies (the refresh cookie is one) over
// plaintext http to localhost, unlike Chromium/Firefox which treat localhost as
// a secure context. The frontend container also serves TLS with a self-signed
// cert (frontend/Dockerfile + nginx.conf) so WebKit can hold the session; the
// cert is untrusted, hence `ignoreHTTPSErrors` on the capture context.
const HTTPS_BASE_URL = process.env['E2E_HTTPS_BASE_URL'] ?? 'https://localhost';
const AUTH_DIR = path.join(__dirname, '.auth');

/**
 * One captured admin session per browser engine. The access token lives only in
 * memory (AuthStore), so storageState holds just the HttpOnly refresh cookie,
 * and the backend rotates that cookie on every app bootstrap with no grace
 * window (RefreshTokenService.rotate). A storageState file is a one-shot
 * snapshot Playwright never rewrites, so a second engine replaying another
 * engine's already-rotated cookie would be bounced to /login. Giving each
 * engine its own freshly-minted session (independent refresh-token families,
 * same admin user) avoids that; the authenticated projects are also chained via
 * `dependencies` (playwright.config.ts) so no two run concurrently.
 */
const ADMIN_SESSIONS: ReadonlyArray<{
  file: string;
  browserType: BrowserType;
  baseURL: string;
  ignoreHTTPSErrors?: boolean;
}> = [
  { file: 'admin.json', browserType: chromium, baseURL: BASE_URL },
  { file: 'admin-firefox.json', browserType: firefox, baseURL: BASE_URL },
  { file: 'admin-webkit.json', browserType: webkit, baseURL: HTTPS_BASE_URL, ignoreHTTPSErrors: true },
];

async function captureAdminSession(session: (typeof ADMIN_SESSIONS)[number]): Promise<void> {
  const browser = await session.browserType.launch();
  const context = await browser.newContext({
    baseURL: session.baseURL,
    ignoreHTTPSErrors: session.ignoreHTTPSErrors,
  });
  const page = await context.newPage();
  await page.goto('/login');
  await page.locator('[data-testid="login-email"]').fill(ADMIN_EMAIL);
  await page.locator('[data-testid="login-password"]').fill(ADMIN_PASSWORD);
  await page.locator('[data-testid="login-submit"]').click();
  await page.waitForURL(`${session.baseURL}/`, { timeout: 15000 });
  await context.storageState({ path: path.join(AUTH_DIR, session.file) });
  await browser.close();
}

/**
 * Seeds a project via the API (so board/members routes have real columns and
 * data instead of an empty/error state) and captures a real browser session
 * via the UI login form, since the app's access token lives in memory and is
 * only rehydrated on page load through the HttpOnly refresh cookie — an API
 * login alone would prove the seed credentials work but wouldn't produce a
 * storageState the app can actually use.
 */
export default async function globalSetup(): Promise<void> {
  mkdirSync(AUTH_DIR, { recursive: true });

  const api = await request.newContext({ baseURL: BASE_URL });
  const accessToken = await loginAsAdmin(api);

  const projectResponse = await api.post('/api/projects', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { name: 'Responsive E2E Project' },
  });
  if (!projectResponse.ok()) {
    throw new Error(`E2E seed project creation failed: ${projectResponse.status()} ${await projectResponse.text()}`);
  }
  const project = (await projectResponse.json()) as { id: number };
  writeFileSync(path.join(AUTH_DIR, 'project.json'), JSON.stringify({ id: project.id }));

  await api.dispose();

  // Serially, not in parallel: keep the logins from racing on the shared admin
  // account while the backend's reuse-detection is armed.
  for (const session of ADMIN_SESSIONS) {
    await captureAdminSession(session);
  }
}
