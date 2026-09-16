import { expect, test } from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD } from './admin-session';
import { loginThroughUi, registerThrowawayUser } from './flow-helpers';

/**
 * Admin-only screen interactions through the UI: activate/deactivate a user
 * on `/admin/users`, and toggle-and-save a permission cell on the
 * role-permission matrix at `/admin/permissions`. Runs on chromium/firefox/
 * webkit via the `*-flow` projects.
 *
 * Unlike every other flow spec, these actions are reachable only by the
 * global admin role, so both tests log in through the UI as the real seeded
 * admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) rather than a throwaway per-file
 * user. The backend's refresh-token rotation-with-reuse-detection revokes
 * ALL of that account's active sessions the moment two logins/refreshes race
 * on it (see `global-setup.ts`'s `ADMIN_SESSIONS` comment), so this file's
 * two admin UI logins must never run concurrently with each other — hence
 * `test.describe.serial` below, which pins both tests to run one after the
 * other in the same worker. That serialization is local to this file only:
 * it never touches `admin.json`/`admin-firefox.json`/`admin-webkit.json`
 * (the sessions `global-setup.ts` captures for the static sweeps), and it
 * does not need a `dependencies` carve-out in `playwright.config.ts` because
 * no *other* flow-spec file logs in as admin at all — every other
 * `*.flow.spec.ts` authenticates as its own throwaway project owner.
 *
 * The permission-matrix test toggles DEVOPS/PROJECT_DELETE. The project
 * owner short-circuit in `ProjectAuthorizationService.hasPermission` grants
 * every permission to a project's owner regardless of what the matrix says
 * (`project.getOwnerId().equals(userId) -> true`), and every other flow spec
 * authenticates as the throwaway owner of its own project — so no matrix
 * cell this test flips can affect a concurrently running sibling spec. DEVOPS
 * is additionally the role least exercised by any other flow's assertions.
 * The test always restores the cell to its pre-test value, so the shared
 * matrix ends byte-identical no matter which value it started at.
 */
test.describe.serial('admin screens', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('deactivates and reactivates a user from /admin/users', async ({ page, request }) => {
    const target = await registerThrowawayUser(request);
    await loginThroughUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto('/admin/users');
    const row = page.locator('[data-testid^="user-row-"]').filter({ hasText: target.email });
    await expect(row).toBeVisible();
    await expect(row.locator('[data-testid="user-active"]')).toContainText('Sí');

    // Deactivate.
    await row.locator('[data-testid="toggle-status"]').click();
    await expect(row.locator('[data-testid="user-active"]')).toContainText('No');
    await expect(row.locator('[data-testid="toggle-status"]')).toHaveText('Activar');

    // Reactivate — leave the throwaway user active, matching a fresh
    // registration's default state.
    await row.locator('[data-testid="toggle-status"]').click();
    await expect(row.locator('[data-testid="user-active"]')).toContainText('Sí');
    await expect(row.locator('[data-testid="toggle-status"]')).toHaveText('Desactivar');
  });

  test('toggles a permission cell on /admin/permissions and restores it', async ({ page }) => {
    await loginThroughUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto('/admin/permissions');
    const cell = page.locator('[data-testid="cell-DEVOPS-PROJECT_DELETE"]');
    await expect(cell).toBeVisible();

    const initiallyChecked = await cell.isChecked();

    try {
      // Flip and save. The cell's "dirty" outline clears only once the save
      // response lands and the store's baseline catches up with the working
      // copy (RolePermissionsStore.save's success handler) — a more reliable
      // "save finished" signal here than the Save button's disabled state,
      // which is true both mid-save and once there is nothing left dirty.
      await cell.click();
      await expect(cell).toBeChecked({ checked: !initiallyChecked });
      await page.locator('[data-testid="save-button"]').click();
      await expect(cell).not.toHaveClass(/dirty/);

      // Reload and confirm the flip persisted server-side.
      await page.reload();
      await expect(page.locator('[data-testid="cell-DEVOPS-PROJECT_DELETE"]')).toBeChecked({
        checked: !initiallyChecked,
      });
    } finally {
      // Restore the cell to its pre-test value even if an assertion above
      // threw, so a failed run never leaves the shared matrix mutated for
      // every subsequent run/spec that touches /admin/permissions. Re-fetch
      // the actual current state (rather than assuming the flip above
      // landed) so this never double-flips a cell that never changed.
      await page.goto('/admin/permissions');
      const restoreCell = page.locator('[data-testid="cell-DEVOPS-PROJECT_DELETE"]');
      if ((await restoreCell.isChecked()) !== initiallyChecked) {
        await restoreCell.click();
        await page.locator('[data-testid="save-button"]').click();
        await expect(restoreCell).not.toHaveClass(/dirty/);
      }
    }

    await page.reload();
    await expect(page.locator('[data-testid="cell-DEVOPS-PROJECT_DELETE"]')).toBeChecked({
      checked: initiallyChecked,
    });
  });
});
