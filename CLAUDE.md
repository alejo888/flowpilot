# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FlowPilot — an AI-assisted agile project management platform. Full plan/scope lives in `FlowPilot_Gestor_Proyectos_IA.md`. Backend: Spring Boot 4 (Java 25). Frontend: Angular 21 (standalone components). Database: PostgreSQL via Flyway. Shipped as Docker Compose services. Built slice-by-slice via an SDD (spec-driven development) process — see `sdd/flowpilot-mvp/*` topics in Engram for the proposal, spec, design, tasks, and apply-progress artifacts driving this build.

## Commands

Backend (from `backend/`):
- `./mvnw -B test` — full test suite (what CI runs)
- `./mvnw test -Dtest=ClassName` — single test class
- `./mvnw spring-boot:run` — run the app locally
- No `.mvn/jvm.config` pins the JDK. If your machine's default `JAVA_HOME` resolves to an older JDK (e.g. 17), export a JDK 25 `JAVA_HOME` before invoking `./mvnw` — there is no repo-level workaround yet.
- Two backend tests (`FlowpilotApplicationTests`, `AuthFlowIntegrationTest`) require Testcontainers/Docker and won't run in a Docker-less sandbox; exclude with `-Dtest='!FlowpilotApplicationTests,!AuthFlowIntegrationTest'` when Docker isn't available.

Frontend (from `frontend/`):
- `npm ci`
- `ng test --watch=false` — unit tests (Vitest under the hood, not Karma/Jasmine, despite the `ng test` invocation)
- `ng build`
- `ng serve` — dev server

Full stack: `docker compose up --build` — backend on `:8080` (proxied under `/api`), frontend/nginx on `:80`, Postgres on `:5432`.

## Architecture

**Backend package layout** (`backend/src/main/java/com/flowpilot/`): `config`, `controller`, `dto`, `entity`, `exception`, `mapper`, `repository`, `security`, `service` — layered, not hexagonal. `config` and `mapper` are placeholder packages (MapStruct is wired into the Maven compiler plugin but has no mappers yet).

**Auth flow** (the only implemented slice so far): Login authenticates via Spring's `AuthenticationManager`, then issues two artifacts: a short-lived (15 min) stateless HS256 JWT access token in the response body (`JwtService`, jjwt 0.12.6), and an opaque, DB-backed refresh token (7-day TTL) as an `HttpOnly; Secure; SameSite=Lax` cookie scoped to `/api/auth` (`CookieService` + `RefreshTokenService`) — only the SHA-256 hash is persisted. `JwtAuthenticationFilter` validates the bearer token on every non-`/api/auth/**` request without touching the DB — a deliberate MVP tradeoff meaning a deactivated user's already-issued access token stays valid until it naturally expires. Because the refresh cookie rides automatically on cross-site requests, `/api/auth/refresh` and `/api/auth/logout` are protected by a custom double-submit CSRF filter (`CsrfProtectionFilter`) instead of Spring Security's built-in CSRF, which is fully disabled: a non-HttpOnly `XSRF-TOKEN` cookie is set alongside the refresh cookie and must be echoed back as an `X-XSRF-TOKEN` header. `RefreshTokenService.rotate()` does rotation-with-reuse-detection: presenting an already-revoked refresh token revokes *all* of that user's active refresh tokens. All errors funnel through `GlobalExceptionHandler` as RFC 7807 `ProblemDetail` responses.

**Migrations** (`backend/src/main/resources/db/migration/`): `V1__users_and_auth.sql` (users, refresh_tokens, password_reset_tokens), `V2__seed_admin.sql` (bootstrap admin `admin@flowpilot.local` / `ChangeMe123!` — local/dev only, must be rotated in real environments). Flyway requires the `spring-boot-starter-flyway` dependency (not just `flyway-core`) to actually auto-run on startup in Spring Boot 4 — this bit CI once already.

**Config profiles**: base `application.yml` holds shared defaults; `application-dev.yml`, `application-docker.yml` (datasource host `db`, the Compose service name), and test's `application-test.yml` override only what differs (datasource, JWT secret, logging). No `application-prod.yml` exists yet. The `docker` profile has no insecure JWT-secret fallback — Compose fails fast if `FLOWPILOT_JWT_SECRET` isn't set.

**Frontend**: standalone-components Angular app, no feature code implemented yet — `core/{api,auth,guards}`, `features/{admin-permissions,admin-users,auth,board,projects/members}`, `shared/` are all placeholder directories.

**API contract**: `api/openapi.yaml` (+ `api/components/`, `api/paths/`) is the hand-authored, contract-first source of truth — write the spec before the controller, not the other way around. Note: CI does not currently lint or check drift against it despite the README implying otherwise; nothing enforces the frontend/backend stay in sync with it.

**Delivery model**: one Git branch/PR per SDD task-slice, stacked toward `main` (see closed PR #1 for the pattern — commit messages reference task IDs like `(1.1)`, `(1.3, 1.4)` from the SDD tasks artifact). CI (`.github/workflows/ci.yml`) runs backend (`./mvnw -B test`, JDK 25) and frontend (`npm ci && ng test --watch=false && ng build`, Node 22) as separate parallel jobs on every PR and push to `main`.
