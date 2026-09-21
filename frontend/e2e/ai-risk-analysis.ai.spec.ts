import { expect, test } from '@playwright/test';

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
 * AI risk analysis (slice 7.6) card in the project dashboard against the stub
 * provider (`FLOWPILOT_AI_PROVIDER=stub`, docker-compose.ci-ai.yml). Only runs
 * under the `chromium-ai` project (`E2E_AI=true`).
 *
 * Signals are deterministic: an URGENT work item with no assignee that is not in
 * the done column raises UNASSIGNED_HIGH_PRIORITY (severity HIGH). Authenticates
 * as a per-test throwaway user who owns the project, never the shared admin session.
 */
test.use({ storageState: { cookies: [], origins: [] } });

let token: string;
let project: ApiProject;

test.beforeEach(async ({ page, request }) => {
  const user = await registerThrowawayUser(request);
  token = await apiLogin(request, user.email, user.password);
  project = await createProject(request, token, `E2E AI Risk Analysis ${Date.now()}`);
  await loginThroughUi(page, user.email, user.password);
});

test.afterEach(async ({ request }) => {
  await deleteProject(request, token, project.id);
});

test('analyzes an unassigned urgent task and shows the summary, signal and recommendations', async ({
  page,
  request,
}) => {
  const columns = await getBoardColumns(request, token, project.id);
  const title = 'Tarea urgente sin responsable';
  const { id } = await createWorkItem(request, token, project.id, columns[0].id, title);
  const urgent = await request.put(`/api/work-items/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title, priority: 'URGENT' },
  });
  expect(urgent.ok()).toBe(true);

  await page.goto(`/projects/${project.id}/dashboard`);
  await expect(page.getByRole('heading', { name: 'Riesgos (IA)' })).toBeVisible();
  await page.locator('[data-testid="analyze-risks"]').click();

  await expect(page.locator('[data-testid="risk-summary"]')).toContainText(
    'Se detectaron 1 señales de riesgo',
  );
  const signal = page.locator('[data-testid="risk-signal"]');
  await expect(signal).toHaveCount(1);
  await expect(signal.locator('[data-testid="risk-severity"]')).toHaveText('Alta');
  await expect(signal).toContainText(title);
  await expect(page.locator('[data-testid="risk-recommendation"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="analyze-risks-error"]')).toHaveCount(0);
});

test('a project without risk signals reports none and lists no signals', async ({ page }) => {
  await page.goto(`/projects/${project.id}/dashboard`);
  await page.locator('[data-testid="analyze-risks"]').click();

  await expect(page.locator('[data-testid="risk-summary"]')).toHaveText('No se detectaron riesgos.');
  await expect(page.locator('[data-testid="risk-signal"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="analyze-risks-error"]')).toHaveCount(0);
});
