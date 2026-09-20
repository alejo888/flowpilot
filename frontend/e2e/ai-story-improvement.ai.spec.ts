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
 * AI story improvement (slice 7.7) in the board detail panel against the stub
 * provider (`FLOWPILOT_AI_PROVIDER=stub`, docker-compose.ci-ai.yml). Only runs
 * under the `chromium-ai` project (`E2E_AI=true`).
 *
 * Authenticates as a per-test throwaway user who owns the project (holds
 * `WORKITEM_EDIT`), never the shared admin session.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const ITEM_TITLE = 'Tarea a mejorar';
const ORIGINAL_DESCRIPTION = 'Descripción original';

let token: string;
let project: ApiProject;
let itemId: number;

async function openPanel(page: Page): Promise<void> {
  await page.goto(`/projects/${project.id}/board`);
  await page.locator('[data-testid="work-item-title"]', { hasText: ITEM_TITLE }).click();
  await expect(page.locator('[data-testid="detail-panel"]')).toBeVisible();
}

async function savedItem(
  page: Page,
): Promise<{ title: string; description: string | null; acceptanceCriteria: string[] }> {
  const response = await page.request.get(`/api/work-items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBe(true);
  return response.json();
}

test.beforeEach(async ({ page, request }) => {
  const user = await registerThrowawayUser(request);
  token = await apiLogin(request, user.email, user.password);
  project = await createProject(request, token, `E2E AI Story Improvement ${Date.now()}`);
  const columns = await getBoardColumns(request, token, project.id);
  ({ id: itemId } = await createWorkItem(request, token, project.id, columns[0].id, ITEM_TITLE));
  const seed = await request.put(`/api/work-items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: ITEM_TITLE, description: ORIGINAL_DESCRIPTION },
  });
  expect(seed.ok()).toBe(true);
  await loginThroughUi(page, user.email, user.password);
});

test.afterEach(async ({ request }) => {
  await deleteProject(request, token, project.id);
});

test('previews the improved story, applies it to the description and saves it', async ({ page }) => {
  await openPanel(page);
  await page.locator('[data-testid="improve-story"]').click();

  const preview = page.locator('[data-testid="improve-story-preview"]');
  await expect(preview).toBeVisible();
  const previewDescription = preview.locator('[data-testid="improve-story-description"]');
  await expect(previewDescription).toHaveText(/^Como .* quiero .* para .*/);
  const suggested = (await previewDescription.textContent())?.trim() ?? '';

  await page.locator('[data-testid="improve-story-apply"]').click();
  await expect(preview).toHaveCount(0);

  const description = page.locator('textarea[name="edit-description"]');
  await expect(description).toHaveValue(suggested);
  await expect(page.locator('input[name="edit-title"]')).toHaveValue(ITEM_TITLE);

  // Nothing is persisted until the panel form is saved.
  expect((await savedItem(page)).description).toBe(ORIGINAL_DESCRIPTION);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect.poll(async () => (await savedItem(page)).description).toBe(suggested);
  const saved = await savedItem(page);
  expect(saved.title).toBe(ITEM_TITLE);
  expect(saved.acceptanceCriteria.length).toBeGreaterThan(0);
});

test('discarding the suggestion leaves the saved values unchanged', async ({ page }) => {
  await openPanel(page);
  await page.locator('[data-testid="improve-story"]').click();
  const preview = page.locator('[data-testid="improve-story-preview"]');
  await expect(preview).toBeVisible();

  await page.locator('[data-testid="improve-story-discard"]').click();
  await expect(preview).toHaveCount(0);

  await expect(page.locator('textarea[name="edit-description"]')).toHaveValue(ORIGINAL_DESCRIPTION);
  await expect(page.locator('input[name="edit-title"]')).toHaveValue(ITEM_TITLE);
  const saved = await savedItem(page);
  expect(saved.title).toBe(ITEM_TITLE);
  expect(saved.description).toBe(ORIGINAL_DESCRIPTION);
  expect(saved.acceptanceCriteria).toEqual([]);
});
