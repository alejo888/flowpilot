import { expect, test } from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD } from './admin-session';

/**
 * Closes PR4's `sdd-verify` CRITICAL 3: every existing Playwright project
 * runs at a 375px mobile viewport, so the desktop half of
 * `app-shell-navigation` (fixed 240px sidebar, active-pill nav highlighting)
 * had zero runtime coverage even though the CSS/markup were structurally
 * correct. This spec runs in its own `desktop-sidebar` project at
 * 1280x800 — comfortably above the `$sidebar-breakpoint: 1024px` — to prove
 * the sidebar renders and the active nav item is highlighted for real, in a
 * real browser, with real media queries applied.
 *
 * Logs in independently rather than reusing `mobile-authenticated`'s shared
 * storageState: that project's captured refresh-token cookie is shared
 * across many parallel workers, and the backend's rotation-with-reuse-
 * detection revokes ALL of a user's active sessions on a detected
 * collision (see `dialog-focus-trap.guest.spec.ts` and PR4's apply-progress,
 * Issue 1). A fresh login plus sequencing this project after the others via
 * `dependencies` (playwright.config.ts) avoids that race.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.locator('[data-testid="login-email"]').fill(ADMIN_EMAIL);
  await page.locator('[data-testid="login-password"]').fill(ADMIN_PASSWORD);
  await page.locator('[data-testid="login-submit"]').click();
  await page.waitForURL(/\/$/, { timeout: 15000 });
});

test('desktop sidebar is visible and the mobile topbar is hidden', async ({ page }) => {
  await page.goto('/projects');

  const sidebar = page.locator('[data-testid="app-sidebar"]');
  await expect(sidebar).toBeVisible();

  const box = await sidebar.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(235);
  expect(box!.width).toBeLessThanOrEqual(245);

  await expect(page.locator('[data-testid="app-topbar"]')).toBeHidden();
  await expect(page.locator('[data-testid="nav-toggle"]')).toBeHidden();
});

test('navigating between nav items moves the active-pill highlight', async ({ page }) => {
  await page.goto('/projects');

  const projectsLink = page.locator('[data-testid="nav-projects"]');
  const usersLink = page.locator('[data-testid="nav-admin-users"]');
  const permissionsLink = page.locator('[data-testid="nav-admin-permissions"]');

  await expect(projectsLink).toHaveClass(/app-sidebar__link--active/);
  await expect(usersLink).not.toHaveClass(/app-sidebar__link--active/);
  await expect(permissionsLink).not.toHaveClass(/app-sidebar__link--active/);

  await usersLink.click();
  await page.waitForURL(/\/admin\/users$/);

  await expect(usersLink).toHaveClass(/app-sidebar__link--active/);
  await expect(projectsLink).not.toHaveClass(/app-sidebar__link--active/);
  await expect(permissionsLink).not.toHaveClass(/app-sidebar__link--active/);

  await permissionsLink.click();
  await page.waitForURL(/\/admin\/permissions$/);

  await expect(permissionsLink).toHaveClass(/app-sidebar__link--active/);
  await expect(usersLink).not.toHaveClass(/app-sidebar__link--active/);
  await expect(projectsLink).not.toHaveClass(/app-sidebar__link--active/);
});
