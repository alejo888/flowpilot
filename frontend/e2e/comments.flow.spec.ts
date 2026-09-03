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
 * Work-item comment lifecycle through the board detail panel: add, edit, then
 * delete behind the confirmation dialog. Runs on chromium/firefox/webkit via
 * the `*-flow` projects.
 *
 * Authenticates as a per-file throwaway user (project owner, so it holds
 * `COMMENT_CREATE`) to keep parallel flow specs off the shared admin session.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const WORK_ITEM_TITLE = 'Historia con comentarios';

let token: string;
let project: ApiProject;

test.beforeEach(async ({ page, request }) => {
  const user = await registerThrowawayUser(request);
  token = await apiLogin(request, user.email, user.password);
  project = await createProject(request, token, `E2E Comments ${Date.now()}`);
  const columns = await getBoardColumns(request, token, project.id);
  await createWorkItem(request, token, project.id, columns[0].id, WORK_ITEM_TITLE);
  await loginThroughUi(page, user.email, user.password);
});

test.afterEach(async ({ request }) => {
  await deleteProject(request, token, project.id);
});

test('adds, edits and deletes a comment on a work item', async ({ page }) => {
  const original = `Comentario ${Date.now()}`;
  const edited = `${original} (editado)`;

  await page.goto(`/projects/${project.id}/board`);
  await page.locator('[data-testid="work-item-title"]', { hasText: WORK_ITEM_TITLE }).click();
  await expect(page.locator('[data-testid="detail-panel"]')).toBeVisible();

  const form = page.locator('[data-testid="work-comment-form"]');
  // The test creates exactly one comment, so a bare `article.work-comment`
  // locator stays unambiguous — and unlike a `hasText` filter it keeps
  // resolving once the article swaps its `<p>` for an edit `<textarea>`.
  const comment = page.locator('article.work-comment');

  // Add.
  await form.locator('textarea').fill(original);
  await form.getByRole('button', { name: 'Comentar' }).click();
  await expect(comment).toContainText(original);

  // Edit.
  await comment.getByRole('button', { name: 'Editar comentario' }).click();
  await comment.getByRole('textbox', { name: 'Editar comentario' }).fill(edited);
  await comment.getByRole('button', { name: 'Guardar comentario' }).click();
  await expect(comment).toContainText(edited);

  // Delete behind the confirmation dialog.
  await comment.getByRole('button', { name: 'Eliminar comentario' }).click();
  const dialog = page.locator('[data-testid="comment-delete-dialog"]');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Sí, eliminar' }).click();

  await expect(comment).toHaveCount(0);
});
