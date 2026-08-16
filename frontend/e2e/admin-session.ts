import type { APIRequestContext } from '@playwright/test';

export const ADMIN_EMAIL = 'admin@flowpilot.local';
export const ADMIN_PASSWORD = 'ChangeMe123!';

/** Logs in as the seeded admin via the API and returns a bearer access token. */
export async function loginAsAdmin(api: APIRequestContext): Promise<string> {
  const response = await api.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!response.ok()) {
    throw new Error(`Admin login failed: ${response.status()} ${await response.text()}`);
  }
  const { accessToken } = (await response.json()) as { accessToken: string };
  return accessToken;
}
