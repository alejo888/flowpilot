import { expect, test, type Page } from '@playwright/test';

import {
  apiLogin,
  createProject,
  deleteProject,
  loginThroughUi,
  registerThrowawayUser,
  type ApiProject,
} from './flow-helpers';

/**
 * Board interaction: create a card through the UI, then move it to another
 * column and confirm the move survives a reload. Runs on chromium/firefox/
 * webkit via the `*-flow` projects.
 *
 * The move is driven through the detail panel's "Columna" `<select>`
 * (`move-to-column-select`), not native CDK drag-and-drop. Both call the same
 * `PUT /api/work-items/{id}/move` endpoint; a cross-browser drag-and-drop
 * spec is a deliberate follow-up because Playwright + CDK DnD is flaky
 * headless, especially on WebKit.
 *
 * Authenticates as a per-file throwaway user (project owner) so parallel flow
 * specs never collide on the shared admin session.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const TARGET_COLUMN = 'En progreso';

let token: string;
let project: ApiProject;

test.beforeEach(async ({ page, request }) => {
  const user = await registerThrowawayUser(request);
  token = await apiLogin(request, user.email, user.password);
  project = await createProject(request, token, `E2E Board ${Date.now()}`);
  await loginThroughUi(page, user.email, user.password);
});

test.afterEach(async ({ request }) => {
  await deleteProject(request, token, project.id);
});

/** The column `<section>` identified by its `<h3>` heading. */
function column(page: Page, name: string) {
  return page.locator('section', {
    has: page.getByRole('heading', { level: 3, name }),
  });
}

test('creates a card and moves it to another column, and the move persists', async ({ page }) => {
  const title = `Card ${Date.now()}`;
  await page.goto(`/projects/${project.id}/board`);

  await page.getByRole('button', { name: 'Crear tarea' }).click();
  await page.locator('input[name="create-title"]').fill(title);
  await page.getByRole('button', { name: 'Guardar tarea' }).click();

  const card = page.locator('[data-testid="work-item-title"]', { hasText: title });
  await expect(card).toBeVisible();
  await expect(
    column(page, TARGET_COLUMN).locator('[data-testid="work-item-title"]', { hasText: title }),
  ).toHaveCount(0);

  // Creating a card opens its detail panel; only click the card if it didn't.
  const panel = page.locator('[data-testid="detail-panel"]');
  if (!(await panel.isVisible())) {
    await card.click();
  }
  await expect(panel).toBeVisible();
  await page.locator('[data-testid="move-to-column-select"]').selectOption({ label: TARGET_COLUMN });
  await page.locator('[data-testid="detail-panel-close"]').click();

  await expect(
    column(page, TARGET_COLUMN).locator('[data-testid="work-item-title"]', { hasText: title }),
  ).toBeVisible();

  await page.reload();
  await expect(
    column(page, TARGET_COLUMN).locator('[data-testid="work-item-title"]', { hasText: title }),
  ).toBeVisible();
});
