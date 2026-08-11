---
name: run-flowpilot
description: Build, run, and drive the FlowPilot docker-compose stack (Angular frontend, Spring Boot backend, Postgres). Use when asked to start FlowPilot, run docker compose up, take a screenshot of a FlowPilot page, smoke-test the admin UI or board, or verify a route/feature actually renders end-to-end.
---

FlowPilot is a 3-service docker-compose stack (nginx-served Angular frontend on `:80`, Spring Boot API on `:8080`, Postgres on `:5432`). Drive it via `.claude/skills/run-flowpilot/driver.mjs` — a small Node/Playwright script that logs in, hits API routes, and screenshots frontend routes with headless Chromium.

All paths below are relative to the repo root.

## Prerequisites

Docker Desktop (with Compose v2+) running. Node 22+ for the driver itself (only used to run Playwright — not part of the app build).

## Setup

The `docker` compose profile has no insecure JWT-secret fallback by design — generate a local one-off secret before first run:

```bash
echo "FLOWPILOT_JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')" > .env
```

`.env` is gitignored — regenerate it on every clean machine, don't try to reuse a committed one.

Install the driver's own dependency (Playwright — not a dependency of the app itself, kept isolated in the skill dir):

```bash
cd .claude/skills/run-flowpilot && npm install && npx playwright install chromium && cd -
```

## Build

```bash
docker compose up --build -d
```

Wait for the backend to actually accept connections (compose reports "Started" before Spring Boot finishes booting):

```bash
timeout 60 bash -c 'until curl -sf -o /dev/null -w "%{http_code}" http://localhost:8080/api/auth/login -X POST -H "Content-Type: application/json" -d "{}" | grep -q 400; do sleep 1; done'
```

## Run (agent path)

```bash
cd .claude/skills/run-flowpilot
node driver.mjs smoke
```

`smoke` proves the stack works end-to-end: backend login + admin API checks, an unauthenticated guard-redirect check (`/projects/1/board` -> `/login?returnUrl=...`), then a real UI login as the seeded admin and screenshots of the three protected routes while authenticated.

Screenshots land in `.claude/skills/run-flowpilot/screenshots/`.

| command | what it does |
|---|---|
| `node driver.mjs login` | POSTs to `/api/auth/login` with the seeded admin (`admin@flowpilot.local` / `ChangeMe123!`), prints `{accessToken, expiresIn}` |
| `node driver.mjs ui-login [email] [pass]` | Submits the real login form in headless Chromium, prints the URL the app navigated to afterward (proves login UI + interceptor + AuthStore hydration work together, not just the API) |
| `node driver.mjs api <path> [--token TOK]` | GETs `http://localhost:8080<path>`, prints status + body |
| `node driver.mjs shot <route> [outfile]` | Screenshots `http://localhost<route>` with headless Chromium, prints visible body text + console errors |
| `node driver.mjs smoke` | api login + admin API checks + unauthenticated guard-redirect check + UI login as admin + screenshots of `/admin/users`, `/admin/permissions`, `/projects/1/board` while authenticated |

To exercise `adminGuard`'s denial path (a non-admin hitting an admin route), register a second user first — `/api/auth/register` defaults new accounts to the non-admin role — then `node driver.mjs ui-login <that-email> <that-password>` and navigate to `/admin/users`; it redirects to `/` with a "No tienes acceso a esta sección." notice (`[data-testid="home-notice"]`).

## Run (human path)

```bash
docker compose up --build   # foreground; Ctrl-C to stop
```

Then open `http://localhost` in a real browser. The login form is at `/login` (seeded admin: `admin@flowpilot.local` / `ChangeMe123!`); `authGuard`/`adminGuard` redirect unauthenticated or under-privileged visitors there or to `/` automatically, so you don't need to hand-craft a bearer token to click around.

## Test

Backend: `cd backend && ./mvnw -B test` (exclude `-Dtest='!FlowpilotApplicationTests,!AuthFlowIntegrationTest'` if Docker/Testcontainers isn't available in that shell).
Frontend: `cd frontend && ng test --watch=false`.

## Gotchas

- **`backend/mvnw` must have LF line endings.** A Windows checkout without `.gitattributes` can leave it CRLF, which breaks the `#!/bin/sh` shebang *inside* the Linux build container (`./mvnw: not found`). The repo now has a root `.gitattributes` forcing `mvnw text eol=lf` — if you ever see this error again, the checkout bypassed it somehow; run `dos2unix backend/mvnw`.
- **The official `maven:3.9-eclipse-temurin-25` image sets `MAVEN_CONFIG=/root/.m2`.** `mvnw`'s own script blindly prepends `$MAVEN_CONFIG` to its CLI args, so that env var gets read as a Maven goal → `[ERROR] Unknown lifecycle phase "/root/.m2"`. `backend/Dockerfile` fixes this with `ENV MAVEN_CONFIG=""` right after `FROM`. Don't remove that line.
- **`/projects/:id/board` swallows its load error silently.** `authGuard` blocks outright unauthenticated visits, but if a session goes bad mid-visit (e.g. refresh fails after the access token expires), `admin/users` and `admin/permissions` render a visible "Request failed" message on the resulting 401 while the board's `BoardStore` doesn't set its `error()` signal on HTTP failure — that 401 only shows up as a minified `ERROR nn` in the browser console, not on screen. Known gap, not fixed as part of this skill — if you're debugging "board shows nothing," this is why.
- **`docker compose up -d` reports containers "Started" before Spring Boot has finished booting.** A `curl` right after will get connection-refused. Poll (see Build section) instead of a fixed sleep.

## Troubleshooting

- **`required variable FLOWPILOT_JWT_SECRET is missing a value`**: no `.env` file. Run the Setup step above.
- **`./mvnw: not found` during `docker compose up --build`**: CRLF line endings on `backend/mvnw` — see Gotchas.
- **`[ERROR] Unknown lifecycle phase "/root/.m2"` during the backend build**: `MAVEN_CONFIG` collision with the base Maven image — see Gotchas. Confirm `backend/Dockerfile` still has `ENV MAVEN_CONFIG=""`.
- **`node driver.mjs smoke` login step fails with a non-200**: backend container likely still booting — re-run the readiness poll from the Build section, or check `docker compose logs backend`.
