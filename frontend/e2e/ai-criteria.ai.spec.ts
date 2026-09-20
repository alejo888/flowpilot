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
 * AI acceptance-criteria generation (slice 7.2) in the board detail panel
 * against the stub provider (`FLOWPILOT_AI_PROVIDER=stub`,
 * docker-compose.ci-ai.yml). Only runs under the `chromium-ai` project
 * (`E2E_AI=true`).
 *
 * Authenticates as a per-test throwaway user who owns the project (holds
 * `WORKITEM_EDIT`), never the shared admin session.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const ITEM_TITLE = 'Tarea sin criterios';

let token: string;
let project: ApiProject;
let itemId: number;

async function openPanel(page: Page): Promise<void> {
  await page.goto(`/projects/${project.id}/board`);
  await page.locator('[data-testid="work-item-title"]', { hasText: ITEM_TITLE }).click();
  await expect(page.locator('[data-testid="detail-panel"]')).toBeVisible();
}

async function savedCriteria(page: Page): Promise<string[]> {
  const response = await page.request.get(`/api/work-items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { acceptanceCriteria: string[] }).acceptanceCriteria;
}

test.beforeEach(async ({ page, request }) => {
  const user = await registerThrowawayUser(request);
  token = await apiLogin(request, user.email, user.password);
  project = await createProject(request, token, `E2E AI Criteria ${Date.now()}`);
  const columns = await getBoardColumns(request, token, project.id);
  ({ id: itemId } = await createWorkItem(request, token, project.id, columns[0].id, ITEM_TITLE));
  await loginThroughUi(page, user.email, user.password);
});

test.afterEach(async ({ request }) => {
  await deleteProject(request, token, project.id);
});

test('generates stub suggestions, adds them to the task and saves them', async ({ page }) => {
  await openPanel(page);
  await page.locator('[data-testid="generate-criteria"]').click();

  const block = page.locator('[data-testid="criteria-suggestion-block"]');
  await expect(block).toBeVisible();
  const suggestions = block.locator('[data-testid="criteria-input"]');
  await expect(suggestions).toHaveCount(3);
  await expect(suggestions.first()).toHaveValue(/^Dado .* cuando el usuario completa la acción/);

  await page.locator('[data-testid="accept-criteria"]').click();
  await expect(block).toHaveCount(0);

  // The accepted suggestions now live in the edit form's editor.
  const formEditor = page.locator('[data-testid="acceptance-criteria-editor"]');
  await expect(formEditor.locator('[data-testid="criteria-input"]')).toHaveCount(3);

  // Nothing is persisted until the panel form is saved.
  expect(await savedCriteria(page)).toEqual([]);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect.poll(async () => (await savedCriteria(page)).length).toBe(3);
  expect((await savedCriteria(page))[0]).toMatch(/cuando el usuario completa la acción/);
});

test('discarding suggestions leaves the saved criteria unchanged', async ({ page, request }) => {
  const seeded = ['Criterio ya guardado'];
  const seed = await request.put(`/api/work-items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: ITEM_TITLE, acceptanceCriteria: seeded },
  });
  expect(seed.ok()).toBe(true);

  await openPanel(page);
  await page.locator('[data-testid="generate-criteria"]').click();
  const block = page.locator('[data-testid="criteria-suggestion-block"]');
  await expect(block).toBeVisible();

  await page.locator('[data-testid="discard-criteria"]').click();
  await expect(block).toHaveCount(0);

  const formInputs = page
    .locator('[data-testid="acceptance-criteria-editor"]')
    .locator('[data-testid="criteria-input"]');
  await expect(formInputs).toHaveCount(1);
  await expect(formInputs.first()).toHaveValue(seeded[0]);
  expect(await savedCriteria(page)).toEqual(seeded);
});

test('shows the 503 error when generation fails', async ({ page }) => {
  await page.route('**/api/projects/*/ai/acceptance-criteria', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: 'El asistente de IA no está disponible en este momento.',
      }),
    }),
  );

  await openPanel(page);
  await page.locator('[data-testid="generate-criteria"]').click();

  const error = page.locator('[data-testid="generate-criteria-error"]');
  await expect(error).toBeVisible();
  await expect(error).toHaveAttribute('role', 'alert');
  await expect(error).toContainText('El asistente de IA no está disponible');
  await expect(page.locator('[data-testid="criteria-suggestion-block"]')).toHaveCount(0);
});
