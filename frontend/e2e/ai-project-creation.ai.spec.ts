import { expect, test } from '@playwright/test';

import { apiLogin, deleteProject, loginThroughUi, registerThrowawayUser } from './flow-helpers';

/**
 * AI project creation (slice 7.4) through the UI against the stub provider
 * (`FLOWPILOT_AI_PROVIDER=stub`, docker-compose.ci-ai.yml). Only runs under the
 * `chromium-ai` project (`E2E_AI=true`).
 *
 * Authenticates as a per-test throwaway user, never the shared admin session.
 * The stub draft is deterministic: 2 epics x 2 stories, named after the
 * description. The code is left empty so runs and retries never collide.
 */
test.use({ storageState: { cookies: [], origins: [] } });

let token: string;
let description: string;
const createdProjectIds: number[] = [];

test.beforeEach(async ({ page, request }) => {
  const user = await registerThrowawayUser(request);
  token = await apiLogin(request, user.email, user.password);
  description = `Plataforma e2e de reservas ${Date.now()}`;
  await loginThroughUi(page, user.email, user.password);
});

test.afterEach(async ({ request }) => {
  for (const id of createdProjectIds.splice(0)) {
    await deleteProject(request, token, id);
  }
});

async function openDraft(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/projects');
  await page.locator('[data-testid="project-create-ai-trigger"]').click();
  await expect(page).toHaveURL(/\/projects\/ai\/new$/);
  await page.locator('[data-testid="ai-project-description"]').fill(description);
  await page.locator('[data-testid="ai-project-generate"]').click();
  await expect(page.locator('[data-testid="ai-project-provenance"]')).toContainText('STUB');
}

test('generates a stub draft, edits it and creates the project with its backlog', async ({
  page,
}) => {
  await openDraft(page);

  await expect(page.locator('[data-testid="ai-project-name"]')).toHaveValue(description);
  await expect(page.locator('[data-testid="ai-epic-title-1"]')).toBeVisible();
  await expect(page.locator('[data-testid="ai-epic-title-2"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="ai-story-title-0-1"]')).toBeVisible();
  await expect(page.locator('[data-testid="ai-story-title-1-1"]')).toBeVisible();

  // Rename the first epic and drop the second story of the second epic.
  await page.locator('[data-testid="ai-epic-title-0"]').fill('Épica renombrada en el e2e');
  await page.locator('[data-testid="ai-story-remove-1-1"]').click();
  await expect(page.locator('[data-testid="ai-story-title-1-1"]')).toHaveCount(0);

  await page.locator('[data-testid="ai-project-confirm"]').click();
  await expect(page).toHaveURL(/\/projects\/\d+\/board$/);
  const projectId = Number(/\/projects\/(\d+)\/board$/.exec(page.url())![1]);
  createdProjectIds.push(projectId);

  // 2 epics + 3 stories, all in the first column.
  const todo = page
    .locator('section.board-column')
    .filter({ has: page.getByRole('heading', { name: 'Por hacer' }) });
  const titles = todo.locator('[data-testid="work-item-title"]');
  await expect(titles).toHaveCount(5);
  await expect(titles.filter({ hasText: 'Épica renombrada en el e2e' })).toHaveCount(1);
  await expect(titles.filter({ hasText: 'Fundamentos del proyecto' })).toHaveCount(0);
  await expect(titles.filter({ hasText: 'Funcionalidad principal' })).toHaveCount(1);
  await expect(titles.filter({ hasText: 'Implementar el flujo principal' })).toHaveCount(1);
  await expect(titles.filter({ hasText: 'Validar con usuarios' })).toHaveCount(0);

  // Hierarchy: epics show child-count badges, stories show the parent hint.
  const badges = todo.locator('[data-testid="child-count-badge"]');
  await expect(badges).toHaveCount(2);
  await expect(badges.filter({ hasText: '2 subtareas' })).toHaveCount(1);
  await expect(badges.filter({ hasText: '1 subtarea' })).toHaveCount(1);
  await expect(todo.getByText('↳ historia: Funcionalidad principal')).toHaveCount(1);
});

test('blocks confirm and shows the hint while a title is blank', async ({ page }) => {
  await openDraft(page);

  const confirm = page.locator('[data-testid="ai-project-confirm"]');
  await expect(confirm).toBeEnabled();
  await expect(page.locator('[data-testid="ai-project-blank-hint"]')).toHaveCount(0);

  await page.locator('[data-testid="ai-project-name"]').fill('   ');
  await expect(confirm).toBeDisabled();
  await expect(page.locator('[data-testid="ai-project-blank-hint"]')).toBeVisible();

  await page.locator('[data-testid="ai-project-name"]').fill('Nombre válido');
  await expect(confirm).toBeEnabled();

  await page.locator('[data-testid="ai-story-title-0-0"]').fill('');
  await expect(confirm).toBeDisabled();
  await expect(page.locator('[data-testid="ai-project-blank-hint"]')).toBeVisible();
});

test('shows the duplicate-code 409 next to the code field and keeps the edited tree', async ({
  page,
  request,
}) => {
  const code = `E2E-AI-${Date.now()}`;
  const response = await request.post('/api/projects', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `E2E AI Code Owner ${Date.now()}`, code },
  });
  expect(response.ok()).toBe(true);
  createdProjectIds.push(((await response.json()) as { id: number }).id);

  await openDraft(page);
  await page.locator('[data-testid="ai-epic-title-0"]').fill('Épica editada antes del 409');
  await page.locator('[data-testid="ai-project-code"]').fill(code);
  await page.locator('[data-testid="ai-project-confirm"]').click();

  await expect(page).toHaveURL(/\/projects\/ai\/new$/);
  await expect(page.locator('[data-testid="ai-project-code"]')).toHaveValue(code);
  await expect(page.locator('[data-testid="ai-epic-title-0"]')).toHaveValue(
    'Épica editada antes del 409',
  );
  await expect(page.locator('[data-testid="ai-project-confirm"]')).toBeVisible();
});
