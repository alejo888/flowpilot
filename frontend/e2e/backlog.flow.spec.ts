import { expect, test, type Page } from '@playwright/test';

import {
  apiLogin,
  createProject,
  createWorkItem,
  deleteProject,
  getBoardColumns,
  loginThroughUi,
  registerThrowawayUser,
  type ApiProject,
} from './flow-helpers';

/**
 * Sprint-planning lifecycle through the UI: create a sprint, pull a backlog
 * item into it, then start and complete the sprint. Runs on chromium/firefox/
 * webkit via the `*-flow` projects.
 *
 * Authenticates as a per-file throwaway user who owns the project (holds
 * `SPRINT_MANAGE`) so parallel flow specs never collide on the shared admin
 * session.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const SPRINT_NAME = 'Sprint de planificación';
const ITEM_TITLE = 'Historia para planificar';

let token: string;
let project: ApiProject;
let itemId: number;

/** A backlog/sprint `<fp-card>` identified by its `<h2>` heading. */
function card(page: Page, heading: string) {
  return page.locator('fp-card', {
    has: page.getByRole('heading', { level: 2, name: heading }),
  });
}

/** `yyyy-mm-dd`, `offsetDays` from today — the format `<input type="date">` wants. */
function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

test.beforeEach(async ({ page, request }) => {
  const user = await registerThrowawayUser(request);
  token = await apiLogin(request, user.email, user.password);
  project = await createProject(request, token, `E2E Backlog ${Date.now()}`);
  const columns = await getBoardColumns(request, token, project.id);
  ({ id: itemId } = await createWorkItem(request, token, project.id, columns[0].id, ITEM_TITLE));
  await loginThroughUi(page, user.email, user.password);
});

test.afterEach(async ({ request }) => {
  await deleteProject(request, token, project.id);
});

test('creates a sprint, assigns a backlog item and runs the sprint to completion', async ({
  page,
}) => {
  await page.goto(`/projects/${project.id}/backlog`);

  // The new item starts unplanned, in the Backlog card.
  await expect(card(page, 'Backlog').locator('.item', { hasText: ITEM_TITLE })).toBeVisible();

  // Create the sprint.
  await page.locator('[data-testid="sprint-name"]').fill(SPRINT_NAME);
  await page.locator('[data-testid="sprint-start"]').fill(isoDate(0));
  await page.locator('[data-testid="sprint-end"]').fill(isoDate(14));
  await page.getByRole('button', { name: 'Crear sprint' }).click();

  const sprint = card(page, SPRINT_NAME);
  await expect(sprint).toBeVisible();
  await expect(sprint.locator('fp-badge')).toHaveText('PLANNED');

  // Pull the backlog item into the sprint via its per-item select.
  await page.locator(`[data-testid="item-sprint-${itemId}"]`).selectOption({ label: SPRINT_NAME });
  await expect(sprint.locator('.items', { hasText: ITEM_TITLE })).toBeVisible();
  await expect(card(page, 'Backlog').locator('.item', { hasText: ITEM_TITLE })).toHaveCount(0);

  // Run the sprint: PLANNED -> ACTIVE -> COMPLETED.
  await sprint.getByRole('button', { name: 'Iniciar sprint' }).click();
  await expect(sprint.locator('fp-badge')).toHaveText('ACTIVE');

  await sprint.getByRole('button', { name: 'Completar sprint' }).click();
  await expect(sprint.locator('fp-badge')).toHaveText('COMPLETED');
});
