import { expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Helpers for the interactive `*.flow.spec.ts` suite. These specs drive real
 * UI flows (form login, project CRUD, board move, comment CRUD) rather than the
 * static route sweeps in `*.authenticated.spec.ts`. API calls here only set up
 * or tear down fixtures — the assertions live in the browser.
 *
 * Every flow spec authenticates as its OWN throwaway user (registered per
 * file), never the shared seeded admin: the backend rotates the refresh cookie
 * with no grace window and revokes every session on reuse, so two specs
 * replaying one captured `admin.json` in parallel workers would knock each
 * other out. A throwaway user gets its own token family and is a project owner
 * (any authenticated user can `POST /api/projects`), which is all the project
 * permissions these flows need.
 */

export interface ApiUser {
  name: string;
  email: string;
  password: string;
}

/** Logs in via the API and returns a bearer access token. */
export async function apiLogin(
  api: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const response = await api.post('/api/auth/login', { data: { email, password } });
  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: ${response.status()} ${await response.text()}`);
  }
  const { accessToken } = (await response.json()) as { accessToken: string };
  return accessToken;
}

/**
 * Logs in through the actual `/login` screen and waits for the authenticated
 * shell. The app keeps its access token in memory only, so a UI login is the
 * way to give a `page` a usable session without a captured storageState.
 */
export async function loginThroughUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('[data-testid="login-email"]').fill(email);
  await page.locator('[data-testid="login-password"]').fill(password);
  await page.locator('[data-testid="login-submit"]').click();
  await page.waitForURL('/');
  await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();
}

/**
 * Registers a throwaway user (unique email per call) so the form-login flow
 * never races the shared admin account's refresh-token reuse detection. The
 * account is left behind on purpose — there is no self-delete endpoint and it
 * is inert once the test ends.
 */
export async function registerThrowawayUser(api: APIRequestContext): Promise<ApiUser> {
  const user: ApiUser = {
    name: 'E2E Flow User',
    email: `e2e-flow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@flowpilot.test`,
    password: 'E2eFlow1234!',
  };
  const response = await api.post('/api/auth/register', { data: user });
  if (!response.ok()) {
    throw new Error(`Register failed: ${response.status()} ${await response.text()}`);
  }
  return user;
}

export interface ApiProject {
  id: number;
  name: string;
}

/** Creates a project via the API (with its default board columns) for a flow fixture. */
export async function createProject(
  api: APIRequestContext,
  token: string,
  name: string,
): Promise<ApiProject> {
  const response = await api.post('/api/projects', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name },
  });
  if (!response.ok()) {
    throw new Error(`Project create failed: ${response.status()} ${await response.text()}`);
  }
  const project = (await response.json()) as { id: number };
  return { id: project.id, name };
}

/** Best-effort fixture cleanup — a failed delete must not fail the test run. */
export async function deleteProject(
  api: APIRequestContext,
  token: string,
  projectId: number,
): Promise<void> {
  await api
    .delete(`/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${token}` } })
    .catch(() => undefined);
}

interface BoardColumn {
  id: number;
  name: string;
}

/** Reads a project's board columns (ordered) so a flow can target one by name. */
export async function getBoardColumns(
  api: APIRequestContext,
  token: string,
  projectId: number,
): Promise<BoardColumn[]> {
  const response = await api.get(`/api/projects/${projectId}/board-columns`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) {
    throw new Error(`Board columns fetch failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as BoardColumn[];
}

/** Creates one work item in the given column via the API for a flow fixture. */
export async function createWorkItem(
  api: APIRequestContext,
  token: string,
  projectId: number,
  columnId: number,
  title: string,
): Promise<{ id: number }> {
  const response = await api.post(`/api/projects/${projectId}/work-items`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { columnId, title },
  });
  if (!response.ok()) {
    throw new Error(`Work item create failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as { id: number };
}
