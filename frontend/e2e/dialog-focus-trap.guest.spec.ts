import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ADMIN_EMAIL, ADMIN_PASSWORD } from './admin-session';

/**
 * Deferred from PR3's `sdd-verify` report (CRITICAL 2): jsdom cannot
 * simulate native Tab-key traversal, so the "Tab cycles within dialog only"
 * scenario (spec: ui-modal) can only be proven at the e2e layer. Uses the
 * board's delete-confirm dialog — one of the 3 `fp-dialog` consumers — as
 * the concrete instance under test; the trap itself lives in the shared
 * `fp-dialog`, so proving it here proves it for all 3 consumers.
 */
function seededProjectId(): number {
  const raw = readFileSync(path.join(__dirname, '.auth', 'project.json'), 'utf-8');
  return (JSON.parse(raw) as { id: number }).id;
}

test('Tab key stays trapped inside the fp-dialog focus trap', async ({ page }) => {
  const projectId = seededProjectId();
  const uniqueTitle = `Tab trap e2e task ${Date.now()}`;

  // Deliberately on the "mobile-guest" project (no shared storageState) and
  // logs in itself: reusing the "mobile-authenticated" project's shared
  // refresh-token cookie across parallel workers was observed to flake —
  // every context that hydrates from the same captured token rotates it, and
  // the backend's rotation-with-reuse-detection revokes ALL of that user's
  // sessions the moment two contexts present the same (already-rotated)
  // token near simultaneously. Unrelated to the dialog/focus-trap behavior
  // under test here; a fresh, independent login sidesteps the race.
  await page.goto('/login');
  await page.locator('[data-testid="login-email"]').fill(ADMIN_EMAIL);
  await page.locator('[data-testid="login-password"]').fill(ADMIN_PASSWORD);
  await page.locator('[data-testid="login-submit"]').click();
  await page.waitForURL(/\/$/, { timeout: 15000 });

  await page.goto(`/projects/${projectId}/board`);

  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
  await page.locator('input[name="create-title"]').fill(uniqueTitle);
  await page.getByRole('button', { name: 'Guardar tarea' }).click();

  // BoardStore.createItem() auto-selects the newly created item, so its
  // detail panel is already open here — no extra card click needed.
  const detailPanel = page.locator('[data-testid="detail-panel"]');
  await expect(detailPanel).toBeVisible();
  await expect(detailPanel.getByText(uniqueTitle)).toBeVisible();
  await detailPanel.locator('[data-testid="detail-delete-button"]').click();

  const dialogPanel = page.locator('[data-testid="delete-dialog"] .fp-dialog__panel');
  await expect(dialogPanel).toBeVisible();

  // cdkTrapFocusAutoCapture moves focus into the panel on open.
  await expect.poll(() => dialogPanel.evaluate((panel) => panel.contains(document.activeElement))).toBe(true);

  const focusableCount = await dialogPanel
    .locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    .count();
  expect(focusableCount).toBeGreaterThan(0);

  // Tab more times than there are focusable elements — if the trap leaked,
  // focus would eventually land on page content behind the dialog (e.g. the
  // board's own buttons), which this assertion would catch on every press.
  for (let i = 0; i < focusableCount * 3; i++) {
    await page.keyboard.press('Tab');
    const activeInsidePanel = await dialogPanel.evaluate((panel) => panel.contains(document.activeElement));
    expect(activeInsidePanel).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialogPanel).toBeHidden();
});
