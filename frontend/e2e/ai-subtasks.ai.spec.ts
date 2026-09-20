import { expect, test, type APIRequestContext } from '@playwright/test';

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
 * AI subtask generation (slice 7.3) through the UI against the stub provider
 * (`FLOWPILOT_AI_PROVIDER=stub`, docker-compose.ci-ai.yml). Only runs under the
 * `chromium-ai` project (`E2E_AI=true`).
 *
 * Authenticates as a per-test throwaway user who owns the project (holds
 * `WORKITEM_CREATE`), never the shared admin session.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const STORY_TITLE = 'Historia para subdividir';

interface ApiWorkItem {
  id: number;
  title: string;
  parentWorkItemId: number | null;
  aiGenerated: boolean;
}

let token: string;
let project: ApiProject;
let storyId: number;
let firstColumnName: string;

async function listItems(api: APIRequestContext): Promise<ApiWorkItem[]> {
  const response = await api.get(`/api/projects/${project.id}/work-items`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as ApiWorkItem[];
}

test.beforeEach(async ({ page, request }) => {
  const user = await registerThrowawayUser(request);
  token = await apiLogin(request, user.email, user.password);
  project = await createProject(request, token, `E2E AI Subtasks ${Date.now()}`);
  const columns = await getBoardColumns(request, token, project.id);
  firstColumnName = columns[0].name;
  ({ id: storyId } = await createWorkItem(request, token, project.id, columns[0].id, STORY_TITLE));
  await loginThroughUi(page, user.email, user.password);
});

test.afterEach(async ({ request }) => {
  await deleteProject(request, token, project.id);
});

test('mode a: board panel link generates stub subtasks and creates them under the story', async ({
  page,
  request,
}) => {
  await page.goto(`/projects/${project.id}/board`);
  await page.locator('[data-testid="work-item-title"]', { hasText: STORY_TITLE }).click();
  await page.locator('[data-testid="generate-subtasks"]').click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${project.id}/ai/subtasks\\?workItemId=${storyId}$`),
  );

  // The story is preselected by the query param, so generation is enabled.
  await page.locator('[data-testid="subtasks-generate"]').click();

  await expect(page.locator('[data-testid="ai-subtasks-provenance"]')).toContainText('STUB');
  await expect(page.locator('[data-testid="subtask-title-0"]')).toHaveValue(
    new RegExp(`^Diseñar: .*${STORY_TITLE}`),
  );
  await expect(page.locator('[data-testid="subtask-title-1"]')).toHaveValue(/^Implementar: /);
  await expect(page.locator('[data-testid="subtask-title-2"]')).toHaveValue(/^Probar: /);
  await expect(page.locator('[data-testid="subtask-title-3"]')).toHaveCount(0);

  await page
    .locator('[data-testid="subtasks-column-select"]')
    .selectOption({ label: firstColumnName });
  await page.locator('[data-testid="subtasks-confirm"]').click();

  // On success the screen navigates back to the board.
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/board$`));

  const children = (await listItems(request)).filter((item) => item.parentWorkItemId === storyId);
  expect(children).toHaveLength(3);
  expect(children.every((item) => item.aiGenerated)).toBe(true);
  expect(children.map((item) => item.title.split(':')[0]).sort()).toEqual([
    'Diseñar',
    'Implementar',
    'Probar',
  ]);
});

test('mode b: nav link with free text generates and creates subtasks without a parent', async ({
  page,
  request,
}) => {
  await page.goto(`/projects/${project.id}`);
  await page.locator('[data-testid="nav-ai-subtasks"]').click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/ai/subtasks$`));

  await page.locator('[data-testid="mode-text"]').click();
  await page.locator('[data-testid="subtasks-story-text"]').fill('Permitir invitar miembros');
  await page.locator('[data-testid="subtasks-generate"]').click();

  await expect(page.locator('[data-testid="ai-subtasks-provenance"]')).toContainText('STUB');
  await expect(page.locator('[data-testid="subtask-title-0"]')).toHaveValue(
    'Diseñar: Permitir invitar miembros',
  );

  await page
    .locator('[data-testid="subtasks-column-select"]')
    .selectOption({ label: firstColumnName });
  await page.locator('[data-testid="subtasks-confirm"]').click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/board$`));

  const created = (await listItems(request)).filter((item) => item.id !== storyId);
  expect(created).toHaveLength(3);
  expect(created.every((item) => item.aiGenerated && item.parentWorkItemId === null)).toBe(true);
});

test('asks for confirmation before generating for a story that already has subtasks', async ({
  page,
  request,
}) => {
  const columns = await getBoardColumns(request, token, project.id);
  const child = await request.post(`/api/projects/${project.id}/work-items`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { columnId: columns[0].id, title: 'Subtarea existente', parentWorkItemId: storyId },
  });
  expect(child.ok()).toBe(true);

  await page.goto(`/projects/${project.id}/ai/subtasks?workItemId=${storyId}`);
  await expect(page.locator('[data-testid="subtasks-existing-count"]')).toContainText('1 subtarea');

  await page.locator('[data-testid="subtasks-generate"]').click();
  const dialog = page.locator('[data-testid="subtasks-regenerate-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Esta historia ya tiene 1 subtarea');
  // Nothing is generated until the user confirms.
  await expect(page.locator('[data-testid="ai-subtasks-provenance"]')).toHaveCount(0);

  await page.locator('[data-testid="subtasks-regenerate-confirm"]').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-testid="ai-subtasks-provenance"]')).toContainText('STUB');
});
