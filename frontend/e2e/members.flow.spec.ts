import { expect, test } from '@playwright/test';

import {
  apiLogin,
  createProject,
  deleteProject,
  loginThroughUi,
  registerThrowawayUser,
  type ApiProject,
  type ApiUser,
} from './flow-helpers';

/**
 * Project-membership lifecycle through the UI: add another user to a project,
 * change their role, then remove them. Runs on chromium/firefox/webkit via the
 * `*-flow` projects.
 *
 * Authenticates as a per-file throwaway user who owns the project (full member
 * permissions) so parallel flow specs never collide on the shared admin
 * session. A second throwaway user is the one being added — it never logs in,
 * it just needs to exist in the user directory.
 */
test.use({ storageState: { cookies: [], origins: [] } });

let ownerToken: string;
let project: ApiProject;
let invitee: ApiUser;

test.beforeEach(async ({ page, request }) => {
  const owner = await registerThrowawayUser(request);
  ownerToken = await apiLogin(request, owner.email, owner.password);
  project = await createProject(request, ownerToken, `E2E Members ${Date.now()}`);
  invitee = await registerThrowawayUser(request);
  await loginThroughUi(page, owner.email, owner.password);
});

test.afterEach(async ({ request }) => {
  await deleteProject(request, ownerToken, project.id);
});

test('adds a member, changes their role and removes them from the UI', async ({ page }) => {
  await page.goto(`/projects/${project.id}/members`);
  await expect(page.locator('[data-testid="members-empty"]')).toBeVisible();

  // Add — narrow the directory select with the filter, then pick the invitee.
  await page.locator('[data-testid="member-add-filter"]').fill(invitee.email);
  await page
    .locator('[data-testid="member-add-user-select"]')
    .selectOption({ label: `${invitee.name} (${invitee.email})` });
  await page.locator('[data-testid="member-add-role-select"]').selectOption('DEVELOPER');
  await page.locator('[data-testid="member-add-submit"]').click();

  const row = page.locator('[data-testid^="member-row-"]').filter({ hasText: invitee.email });
  await expect(row).toBeVisible();
  await expect(row.locator('[data-testid="member-role"]')).toHaveText('Desarrollador');

  // Change role.
  await row.locator('[data-testid="member-role-select"]').selectOption('QA');
  await expect(row.locator('[data-testid="member-role"]')).toHaveText('QA');

  // Remove (no confirmation dialog for removing someone else).
  await row.locator('[data-testid="member-remove"]').click();
  await expect(row).toHaveCount(0);
  await expect(page.locator('[data-testid="members-empty"]')).toBeVisible();
});
