// Driver for the FlowPilot docker-compose stack. Run from the skill dir
// (`.claude/skills/run-flowpilot/`) after `npm install` there.
//
// Usage:
//   node driver.mjs login                     -> prints {accessToken, expiresIn}
//   node driver.mjs api <path> [--token TOK]   -> GETs http://localhost:8080<path>, prints status+body
//   node driver.mjs shot <route> [outfile]     -> screenshots http://localhost<route> via headless Chromium
//   node driver.mjs smoke                      -> login + admin API checks + screenshots of known routes
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

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (cmd === 'login') {
    const result = await login();
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
    console.log('--- login ---');
    const { accessToken } = await login();
    console.log('OK, token acquired');

    for (const p of ['/api/users', '/api/admin/role-permissions']) {
      console.log(`--- api ${p} ---`);
      const r = await api(p, accessToken);
      console.log(r.status === 200 ? 'OK' : `UNEXPECTED STATUS ${r.status}: ${r.body}`);
    }

    for (const route of ['/admin/users', '/admin/permissions', '/projects/1/board']) {
      console.log(`--- shot ${route} ---`);
      const r = await shot(route);
      console.log(`saved: ${r.outPath}`);
      if (r.consoleErrors.some((e) => !e.includes('401'))) {
        console.log(`UNEXPECTED console errors: ${JSON.stringify(r.consoleErrors)}`);
      } else {
        console.log('console errors: only expected 401s (no login UI/JWT interceptor yet)');
      }
    }
    return;
  }

  console.error('Usage: node driver.mjs <login|api <path>|shot <route> [outfile]|smoke>');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
