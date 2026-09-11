import { expect, test, type Locator, type Page } from '@playwright/test';

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
 * Native CDK drag-and-drop on the board: pick up a card by mouse and drop it
 * in another column, then confirm the move persists. `board-move.flow.spec.ts`
 * already covers the same `PUT /api/work-items/{id}/move` endpoint through the
 * detail panel's "Columna" `<select>`; this spec is the deliberate follow-up
 * exercising the actual pointer-driven drag CDK renders.
 *
 * Runs on chromium and firefox only (see `playwright.config.ts`'s
 * `webkit-flow` `testIgnore`) — CDK drag-and-drop over Playwright's
 * synthesized mouse events is flakiest on WebKit, and this file already
 * carries its own retry budget below rather than raising retries for the
 * whole flow suite.
 *
 * Authenticates as a per-file throwaway user (project owner, so it holds
 * `WORKITEM_MOVE`) so parallel flow specs never collide on the shared admin
 * session.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ retries: 2 });

const TARGET_COLUMN = 'En progreso';

let token: string;
let project: ApiProject;

test.beforeEach(async ({ page, request }) => {
  const user = await registerThrowawayUser(request);
  token = await apiLogin(request, user.email, user.password);
  project = await createProject(request, token, `E2E DnD ${Date.now()}`);
  await loginThroughUi(page, user.email, user.password);
});

test.afterEach(async ({ request }) => {
  await deleteProject(request, token, project.id);
});

/** The column `<section>` identified by its `<h3>` heading. */
function column(page: Page, name: string): Locator {
  return page.locator('section.board-column', {
    has: page.getByRole('heading', { level: 3, name }),
  });
}

/**
 * Drags `card` onto `dropList` via real mouse events (CDK drag-drop listens
 * to pointer/mouse events, not the HTML5 drag-and-drop API, so
 * `locator.dragTo()`'s native drag events don't engage it). A short initial
 * move clears CDK's drag-start threshold before the longer move toward the
 * target, and both moves are stepped so CDK's drop-list hit-testing sees the
 * pointer travel through the board instead of teleporting.
 */
async function dragCardToColumn(page: Page, cardEl: Locator, dropList: Locator): Promise<void> {
  const cardBox = await cardEl.boundingBox();
  const targetBox = await dropList.boundingBox();
  if (!cardBox || !targetBox) {
    throw new Error('dragCardToColumn: source or target has no bounding box');
  }

  const startX = cardBox.x + cardBox.width / 2;
  const startY = cardBox.y + cardBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + Math.min(targetBox.height / 2, 80);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 6, startY + 6, { steps: 5 });
  await page.mouse.move(endX, endY, { steps: 15 });
  await page.mouse.up();
}

test('drags a card into another column and the move persists', async ({ page, request }) => {
  const columns = await getBoardColumns(request, token, project.id);
  const title = `Drag ${Date.now()}`;
  await createWorkItem(request, token, project.id, columns[0].id, title);

  await page.goto(`/projects/${project.id}/board`);
  const card = page.locator('.board-card', { has: page.getByText(title, { exact: true }) });
  await expect(card).toBeVisible();

  const target = column(page, TARGET_COLUMN);
  await dragCardToColumn(page, card, target.locator('.board-column-list'));

  await expect(target.locator('[data-testid="work-item-title"]', { hasText: title })).toBeVisible();

  await page.reload();
  await expect(target.locator('[data-testid="work-item-title"]', { hasText: title })).toBeVisible();
});
