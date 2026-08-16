import { request } from '@playwright/test';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { loginAsAdmin } from './admin-session';

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost';
const AUTH_DIR = path.join(__dirname, '.auth');
const PROJECT_FILE = path.join(AUTH_DIR, 'project.json');

/** Deletes the project global-setup seeded, so repeated local runs don't pile up test data. */
export default async function globalTeardown(): Promise<void> {
  if (!existsSync(PROJECT_FILE)) {
    return;
  }
  const { id } = JSON.parse(readFileSync(PROJECT_FILE, 'utf-8')) as { id: number };

  const api = await request.newContext({ baseURL: BASE_URL });
  const accessToken = await loginAsAdmin(api).catch(() => null);
  if (accessToken) {
    await api.delete(`/api/projects/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  }
  await api.dispose();

  rmSync(AUTH_DIR, { recursive: true, force: true });
}
