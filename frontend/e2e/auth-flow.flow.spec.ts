import { expect, test } from '@playwright/test';

import { registerThrowawayUser } from './flow-helpers';

/**
 * Form-driven auth: real login through the screen (not a restored
 * storageState), session survival across a reload, the route guard's
 * redirect, and logout. Runs on chromium/firefox/webkit via the `*-flow`
 * projects.
 *
 * These tests start logged out — the describe overrides the admin
 * storageState the `*-flow` projects otherwise inject — and authenticate as a
 * throwaway user so they never race the shared admin account's refresh-token
 * reuse detection.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test('logs in through the form and lands on the authenticated shell', async ({ page, request }) => {
  const user = await registerThrowawayUser(request);

  await page.goto('/login');
  await page.locator('[data-testid="login-email"]').fill(user.email);
  await page.locator('[data-testid="login-password"]').fill(user.password);
  await page.locator('[data-testid="login-submit"]').click();

  await page.waitForURL('/');
  await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="nav-projects"]')).toBeVisible();
});

test('keeps the session across a full page reload', async ({ page, request }) => {
  const user = await registerThrowawayUser(request);

  await page.goto('/login');
  await page.locator('[data-testid="login-email"]').fill(user.email);
  await page.locator('[data-testid="login-password"]').fill(user.password);
  await page.locator('[data-testid="login-submit"]').click();
  await page.waitForURL('/');

  await page.reload();

  await expect(page).toHaveURL('/');
  await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();
});

test('redirects an unauthenticated visit to a guarded route back to /login', async ({ page }) => {
  await page.goto('/projects');

  await expect(page).toHaveURL(/\/login(\?|$)/);
});

test('logs out back to the login screen', async ({ page, request }) => {
  const user = await registerThrowawayUser(request);

  await page.goto('/login');
  await page.locator('[data-testid="login-email"]').fill(user.email);
  await page.locator('[data-testid="login-password"]').fill(user.password);
  await page.locator('[data-testid="login-submit"]').click();
  await page.waitForURL('/');

  await page.locator('[data-testid="logout-button"]').click();

  // The logout redirect races the async session clear, so assert the settled
  // state: the session is gone and a guarded route now bounces to /login.
  await expect(page.locator('[data-testid="logout-button"]')).toBeHidden();
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/login(\?|$)/);
  await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
});
