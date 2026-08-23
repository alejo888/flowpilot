import { readFileSync } from 'node:fs';
import path from 'node:path';

import { test } from '@playwright/test';

import { expectNoA11yViolations } from './assert-no-a11y-violations';
import { staticAuthenticatedRoutes } from './routes';

function seededProjectId(): number {
  const raw = readFileSync(path.join(__dirname, '.auth', 'project.json'), 'utf-8');
  return (JSON.parse(raw) as { id: number }).id;
}

for (const route of staticAuthenticatedRoutes) {
  test(`has no WCAG 2.1 A/AA violations: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expectNoA11yViolations(page);
  });
}

test('has no WCAG 2.1 A/AA violations: board', async ({ page }) => {
  await page.goto(`/projects/${seededProjectId()}/board`);
  await expectNoA11yViolations(page);
});

test('has no WCAG 2.1 A/AA violations: project dashboard', async ({ page }) => {
  await page.goto(`/projects/${seededProjectId()}/dashboard`);
  await expectNoA11yViolations(page);
});

test('has no WCAG 2.1 A/AA violations: project backlog', async ({ page }) => {
  await page.goto(`/projects/${seededProjectId()}/backlog`);
  await expectNoA11yViolations(page);
});

test('has no WCAG 2.1 A/AA violations: project members', async ({ page }) => {
  await page.goto(`/projects/${seededProjectId()}/members`);
  await expectNoA11yViolations(page);
});
