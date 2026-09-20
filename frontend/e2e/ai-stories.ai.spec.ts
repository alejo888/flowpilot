import { expect, test } from '@playwright/test';

import {
  apiLogin,
  createProject,
  deleteProject,
  loginThroughUi,
  registerThrowawayUser,
  type ApiProject,
} from './flow-helpers';

/**
 * AI user-story generation (slice 7.1) through the UI against the stub provider
 * (`FLOWPILOT_AI_PROVIDER=stub`, docker-compose.ci-ai.yml). Only runs under the
 * `chromium-ai` project (`E2E_AI=true`).
 *
 * Authenticates as a per-test throwaway user who owns the project (holds
 * `WORKITEM_CREATE`), never the shared admin session.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const REQUIREMENT = 'exportar el tablero a CSV';

interface ApiWorkItem {
  id: number;
  title: string;
  aiGenerated: boolean;
  aiModel: string | null;
  acceptanceCriteria: string[];
}

let token: string;
let project: ApiProject;

test.beforeEach(async ({ page, request }) => {
  const user = await registerThrowawayUser(request);
  token = await apiLogin(request, user.email, user.password);
  project = await createProject(request, token, `E2E AI Stories ${Date.now()}`);
  await loginThroughUi(page, user.email, user.password);
});

test.afterEach(async ({ request }) => {
  await deleteProject(request, token, project.id);
});

test('generates a stub draft, edits it and creates an AI-provenance work item', async ({
  page,
  request,
}) => {
  await page.goto(`/projects/${project.id}`);
  await page.locator('[data-testid="nav-ai-stories"]').click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/ai/user-stories$`));

  await page.locator('[data-testid="ai-requirement"]').fill(REQUIREMENT);
  await page.locator('[data-testid="ai-generate"]').click();

  // Stub provenance and the deterministic draft.
  await expect(page.locator('[data-testid="ai-provenance"]')).toContainText('STUB');
  // The title is never AI-seeded: the user names the work item, and confirm is blocked until then.
  const title = page.locator('[data-testid="ai-story-title"]');
  await expect(title).toHaveValue('');
  await expect(page.locator('[data-testid="ai-confirm"]')).toBeDisabled();
  await title.fill('Historia generada por el stub');
  await expect(page.locator('[data-testid="ai-story-description"]')).toHaveValue(
    new RegExp(REQUIREMENT),
  );
  const firstCriterion = page.locator('[data-testid="ai-criterion-input-0"]');
  await expect(firstCriterion).toHaveValue(new RegExp(`^Dado el requisito "${REQUIREMENT}"`));
  await expect(page.locator('[data-testid="ai-criterion-input-2"]')).toBeVisible();
  await expect(page.locator('[data-testid="ai-criterion-input-3"]')).toHaveCount(0);

  // Edit one criterion and add a fourth.
  const editedCriterion = 'Criterio editado en el e2e';
  const addedCriterion = 'Criterio añadido en el e2e';
  await firstCriterion.fill(editedCriterion);
  await page.locator('[data-testid="ai-criterion-add"]').click();
  await page.locator('[data-testid="ai-criterion-input-3"]').fill(addedCriterion);

  await page.locator('[data-testid="ai-confirm"]').click();
  await expect(page.locator('[data-testid="ai-stories-success"]')).toHaveText(
    'Tarea creada a partir de la historia generada.',
  );

  // The persisted work item carries the AI provenance and the edited criteria.
  const response = await request.get(`/api/projects/${project.id}/work-items`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBe(true);
  const items = (await response.json()) as ApiWorkItem[];
  expect(items).toHaveLength(1);
  const [item] = items;
  expect(item.aiGenerated).toBe(true);
  // The stub reports no model, so provenance is the flag alone.
  expect(item.aiModel).toBeNull();
  expect(item.acceptanceCriteria).toHaveLength(4);
  expect(item.acceptanceCriteria[0]).toBe(editedCriterion);
  expect(item.acceptanceCriteria[3]).toBe(addedCriterion);
});

test('shows the 503 error and keeps the typed requirement when generation fails', async ({
  page,
}) => {
  await page.route('**/api/projects/*/ai/user-stories', (route) =>
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

  await page.goto(`/projects/${project.id}/ai/user-stories`);
  await page.locator('[data-testid="ai-requirement"]').fill(REQUIREMENT);
  await page.locator('[data-testid="ai-generate"]').click();

  await expect(page.locator('[data-testid="ai-stories-error"]')).toBeVisible();
  await expect(page.locator('[data-testid="ai-requirement"]')).toHaveValue(REQUIREMENT);
  await expect(page.locator('[data-testid="ai-provenance"]')).toHaveCount(0);
});
