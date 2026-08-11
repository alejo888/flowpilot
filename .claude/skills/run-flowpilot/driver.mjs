// Driver for the FlowPilot docker-compose stack. Run from the skill dir
// (`.claude/skills/run-flowpilot/`) after `npm install` there.
//
// Usage:
//   node driver.mjs login                     -> prints {accessToken, expiresIn}
//   node driver.mjs api <path> [--token TOK]   -> GETs http://localhost:8080<path>, prints status+body
//   node driver.mjs shot <route> [outfile]     -> screenshots http://localhost<route> via headless Chromium
//   node driver.mjs ui-login [email] [pass]    -> submits the real login form, prints the URL landed on
//   node driver.mjs smoke                      -> login (API + UI) + admin API checks + guard/redirect checks + screenshots
//
// Screenshots land in ./screenshots/ (relative to this file) unless an
// outfile is given.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const FRONTEND = 'http://localhost';
const BACKEND = 'http://localhost:8080';
const ADMIN_EMAIL = process.env.FLOWPILOT_ADMIN_EMAIL ?? 'admin@flowpilot.local';
const ADMIN_PASSWORD = process.env.FLOWPILOT_ADMIN_PASSWORD ?? 'ChangeMe123!';

const SCREENSHOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots');

async function login() {
  const res = await fetch(`${BACKEND}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body; // { accessToken, expiresIn }
}

async function api(pathname, token) {
  const res = await fetch(`${BACKEND}${pathname}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function shot(route, outfile) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const outPath = outfile ?? path.join(SCREENSHOT_DIR, `${route.replace(/\W+/g, '_') || 'root'}.png`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto(`${FRONTEND}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800); // let signals/change-detection settle after the last network response
  await page.screenshot({ path: outPath });
  const bodyText = (await page.evaluate(() => document.body.innerText)).trim();

  await browser.close();
  return { outPath, bodyText, consoleErrors };
}

// Submits the real login form (features/auth/login.component.ts) and reports
// the URL the app navigated to afterward — this is how you prove the login
// UI + JWT interceptor + AuthStore hydration actually work together, not
// just the backend endpoint in isolation.
async function uiLogin(email = ADMIN_EMAIL, password = ADMIN_PASSWORD, startRoute = '/login') {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${FRONTEND}${startRoute}`, { waitUntil: 'networkidle' });
  await page.fill('[data-testid="login-email"]', email);
  await page.fill('[data-testid="login-password"]', password);
  await page.click('[data-testid="login-submit"]');
  await page.waitForTimeout(1000);
  const landedUrl = page.url();
  await browser.close();
  return { landedUrl };
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (cmd === 'login') {
    const result = await login();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'ui-login') {
    const [email, password] = args;
    const result = await uiLogin(email, password);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'api') {
    const [pathname] = args;
    const tokenFlagIdx = args.indexOf('--token');
    const token = tokenFlagIdx !== -1 ? args[tokenFlagIdx + 1] : undefined;
    const result = await api(pathname, token);
    console.log(`${result.status}`);
    console.log(result.body);
    return;
  }

  if (cmd === 'shot') {
    const [route, outfile] = args;
    const result = await shot(route, outfile);
    console.log(`screenshot: ${result.outPath}`);
    console.log(`body text (first 300 chars): ${result.bodyText.slice(0, 300)}`);
    console.log(`console errors: ${JSON.stringify(result.consoleErrors)}`);
    return;
  }

  if (cmd === 'smoke') {
    console.log('--- api login ---');
    const { accessToken } = await login();
    console.log('OK, token acquired');

    for (const p of ['/api/users', '/api/admin/role-permissions']) {
      console.log(`--- api ${p} ---`);
      const r = await api(p, accessToken);
      console.log(r.status === 200 ? 'OK' : `UNEXPECTED STATUS ${r.status}: ${r.body}`);
    }

    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const browser = await chromium.launch();

    console.log('--- unauthenticated board -> guard redirect ---');
    {
      const page = await browser.newPage();
      await page.goto(`${FRONTEND}/projects/1/board`, { waitUntil: 'networkidle' });
      const url = page.url();
      console.log(
        url.includes('/login') && url.includes('returnUrl')
          ? `OK, redirected to ${url}`
          : `UNEXPECTED: expected redirect to /login?returnUrl=..., got ${url}`,
      );
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'smoke_unauth_redirect.png') });
      await page.close();
    }

    console.log('--- ui-login (admin) then authenticated routes, same browser context ---');
    {
      const page = await browser.newPage();
      await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle' });
      await page.fill('[data-testid="login-email"]', ADMIN_EMAIL);
      await page.fill('[data-testid="login-password"]', ADMIN_PASSWORD);
      await page.click('[data-testid="login-submit"]');
      await page.waitForTimeout(1000);
      console.log(
        page.url() === `${FRONTEND}/` ? 'OK, landed on home' : `UNEXPECTED landing URL: ${page.url()}`,
      );

      for (const route of ['/admin/users', '/admin/permissions', '/projects/1/board']) {
        await page.goto(`${FRONTEND}${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
        const outPath = path.join(SCREENSHOT_DIR, `smoke_authed${route.replace(/\W+/g, '_')}.png`);
        await page.screenshot({ path: outPath });
        console.log(
          page.url().includes(route) ? `OK: ${route} -> saved ${outPath}` : `UNEXPECTED URL after ${route}: ${page.url()}`,
        );
      }
      await page.close();
    }

    await browser.close();
    console.log('\nNote: this covers the seeded admin only. To exercise adminGuard\'s');
    console.log('denial path, POST /api/auth/register a second user (default role is');
    console.log('non-admin) and log in as them via `node driver.mjs ui-login <email> <pass>`.');
    return;
  }

  console.error('Usage: node driver.mjs <login|ui-login [email] [pass]|api <path>|shot <route> [outfile]|smoke>');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
