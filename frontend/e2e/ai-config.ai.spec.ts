import { expect, test } from '@playwright/test';

import { apiLogin, registerThrowawayUser } from './flow-helpers';

/**
 * Smoke check for the `e2e-ai` CI job: the stack must be booted with
 * `FLOWPILOT_AI_ENABLED=true` (docker-compose.ci-ai.yml), otherwise every other
 * `*.ai.spec.ts` would silently test a hidden UI. Only runs under the
 * `chromium-ai` project (`E2E_AI=true`).
 *
 * Authenticates as a per-file throwaway user, never the shared admin session.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test('GET /api/ai/config reports the AI feature as enabled', async ({ request }) => {
  const user = await registerThrowawayUser(request);
  const token = await apiLogin(request, user.email, user.password);

  const response = await request.get('/api/ai/config', {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(response.ok()).toBe(true);
  expect(((await response.json()) as { enabled: boolean }).enabled).toBe(true);
});
