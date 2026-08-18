import { expect, test } from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD } from './admin-session';

/**
 * Promotes PR5's `sdd-verify` throwaway live computed-style probe (WARNING
 * 6) into a permanent, CI-enforced test. jsdom cannot resolve CSS
 * custom-property cascades, and the structural `styles.density.spec.ts`
 * spec only proves what the stylesheet *declares*, not that it actually
 * applies — this is the runtime proof neither of those layers can provide:
 * a real card's computed padding changes with the density toggle, colors
 * and radii stay untouched, and the preference survives a real reload.
 *
 * Runs in the `desktop-sidebar` project so the sidebar footer's density
 * toggle (rendered only on desktop-authenticated shell, spec: ui-density)
 * is reachable without a drawer-open step.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.locator('[data-testid="login-email"]').fill(ADMIN_EMAIL);
  await page.locator('[data-testid="login-password"]').fill(ADMIN_PASSWORD);
  await page.locator('[data-testid="login-submit"]').click();
  await page.waitForURL(/\/$/, { timeout: 15000 });
});

test('toggling density changes real spacing and reload persists the choice, leaving color/radius untouched', async ({
  page,
}) => {
  await page.goto('/projects');

  const compactButton = page.locator('[data-testid="density-compact-button"]');
  await expect(compactButton).toBeVisible();

  // `.project-create-card` is always rendered on `/projects` (the create
  // form), unlike a project row card which depends on seeded data.
  const card = page.locator('fp-card.project-create-card');
  await expect(card).toBeVisible();

  const readCardStyle = () =>
    card.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        padding: style.padding,
        borderRadius: style.borderRadius,
        color: style.color,
      };
    });

  const comfortableStyle = await readCardStyle();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-fp-density')))
    .toBe('comfortable');

  await compactButton.click();
  await expect(compactButton).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-fp-density')))
    .toBe('compact');

  const compactStyle = await readCardStyle();
  expect(compactStyle.padding).not.toBe(comfortableStyle.padding);
  // Density Scope Constraint (spec: ui-density) — color and radius must
  // never change with density, only spacing.
  expect(compactStyle.borderRadius).toBe(comfortableStyle.borderRadius);
  expect(compactStyle.color).toBe(comfortableStyle.color);

  await page.reload();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-fp-density')))
    .toBe('compact');
  await expect(page.locator('[data-testid="density-compact-button"]')).toHaveAttribute('aria-pressed', 'true');
});
