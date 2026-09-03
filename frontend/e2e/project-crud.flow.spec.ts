import { expect, test } from '@playwright/test';

import {
  apiLogin,
  deleteProject,
  loginThroughUi,
  registerThrowawayUser,
  type ApiUser,
} from './flow-helpers';

/**
 * Project lifecycle straight through the UI: create via the dialog, rename and
 * change status on the detail screen, then delete behind the confirmation
 * dialog. Runs on chromium/firefox/webkit via the `*-flow` projects.
 *
 * Authenticates as a per-file throwaway user (its own refresh-token family) so
 * parallel flow specs never collide on the shared admin session. That user
 * owns every project it creates, which carries full project permissions.
 */
test.use({ storageState: { cookies: [], origins: [] } });

let user: ApiUser;
let token: string;
let createdProjectId: number | null = null;

test.beforeEach(async ({ page, request }) => {
  user = await registerThrowawayUser(request);
  token = await apiLogin(request, user.email, user.password);
  await loginThroughUi(page, user.email, user.password);
});

test.afterEach(async ({ request }) => {
  if (createdProjectId !== null) {
    await deleteProject(request, token, createdProjectId);
    createdProjectId = null;
  }
});

test('creates, renames, restatuses and deletes a project from the UI', async ({ page }) => {
  const name = `E2E CRUD ${Date.now()}`;
  const renamed = `${name} (renombrado)`;

  await page.goto('/projects');
  await page.locator('[data-testid="project-create-trigger"]').click();
  await expect(page.locator('[data-testid="project-create-dialog"]')).toBeVisible();
  await page.locator('[data-testid="project-create-name"]').fill(name);
  await page.locator('[data-testid="project-create-submit"]').click();

  // The new row lands in the list; follow it to the detail screen.
  const row = page.locator('[data-testid^="project-row-"]').filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole('link', { name }).click();

  await expect(page).toHaveURL(/\/projects\/\d+$/);
  createdProjectId = Number(new URL(page.url()).pathname.split('/').pop());
  await expect(page.locator('[data-testid="project-detail-name"]')).toHaveText(name);

  // Rename.
  await page.locator('[data-testid="project-edit-name"]').fill(renamed);
  await page.locator('[data-testid="project-edit-submit"]').click();
  await expect(page.locator('[data-testid="project-detail-name"]')).toHaveText(renamed);

  // Change status.
  await page.locator('[data-testid="project-status-select"]').selectOption('ACTIVO');
  await expect(page.locator('[data-testid="project-detail-status"]')).toHaveText('ACTIVO');

  // Delete behind the confirmation dialog.
  await page.locator('[data-testid="project-delete"]').click();
  await expect(page.locator('[data-testid="project-delete-dialog"]')).toBeVisible();
  await page.locator('[data-testid="project-delete-confirm"]').click();

  await expect(page).toHaveURL(/\/projects$/);
  await expect(
    page.locator('[data-testid^="project-row-"]').filter({ hasText: renamed }),
  ).toHaveCount(0);
  createdProjectId = null; // deleted through the UI — nothing for afterEach to clean.
});
