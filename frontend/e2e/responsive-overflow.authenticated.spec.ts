import { test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expectNoHorizontalOverflow } from './assert-no-overflow';

function seededProjectId(): number {
  const raw = readFileSync(path.join(__dirname, '.auth', 'project.json'), 'utf-8');
  return (JSON.parse(raw) as { id: number }).id;
}

const staticRoutes = ['/', '/projects', '/admin/users', '/admin/permissions'];

for (const route of staticRoutes) {
  test(`stays within viewport width: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expectNoHorizontalOverflow(page);
  });
}

test('stays within viewport width: board', async ({ page }) => {
  await page.goto(`/projects/${seededProjectId()}/board`);
  await expectNoHorizontalOverflow(page);
});

test('stays within viewport width: project members', async ({ page }) => {
  await page.goto(`/projects/${seededProjectId()}/members`);
  await expectNoHorizontalOverflow(page);
});
