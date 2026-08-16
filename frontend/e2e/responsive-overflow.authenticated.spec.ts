import { test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { loginAsAdmin } from './admin-session';
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

test('stays within viewport width: /projects with an unbreakable long name/technologies', async ({
  page,
  request,
}) => {
  // A single long word (no spaces) doesn't wrap by default — guards against
  // the content-driven overflow found 2026-08-16: .project-row-main had no
  // min-width: 0, so a flex row let it grow to its content's full intrinsic
  // width instead of shrinking to fit.
  const accessToken = await loginAsAdmin(request);
  const created = await request.post('/api/projects', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      name: 'ProyectoConNombreMuyLargoSinEspaciosParaProbarOverflowHorizontal',
      technologies: 'AngularSpringBootPostgreSQLDockerKubernetesTypeScriptJavaMavenNginxRedis',
    },
  });
  const project = (await created.json()) as { id: number };

  try {
    await page.goto('/projects');
    await expectNoHorizontalOverflow(page);
  } finally {
    await request.delete(`/api/projects/${project.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
});
