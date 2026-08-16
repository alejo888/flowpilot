import { chromium, request } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from './admin-session';

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost';
const AUTH_DIR = path.join(__dirname, '.auth');

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

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto('/login');
  await page.locator('[data-testid="login-email"]').fill(ADMIN_EMAIL);
  await page.locator('[data-testid="login-password"]').fill(ADMIN_PASSWORD);
  await page.locator('[data-testid="login-submit"]').click();
  await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 });
  await context.storageState({ path: path.join(AUTH_DIR, 'admin.json') });
  await browser.close();
}
