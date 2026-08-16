# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FlowPilot — an AI-assisted agile project management platform intended as a personal portfolio project. Full product vision lives in `FlowPilot_Gestor_Proyectos_IA.md`; that document is broader than the current MVP. Backend: Spring Boot 4 (Java 25). Frontend: Angular 21 (standalone components). Database: PostgreSQL via Flyway. Shipped as Docker Compose services.

## Current MVP status

Implemented and covered by backend/frontend tests at a high level:

- Auth/session backend: register, login, refresh-token rotation, logout, forgot-password, reset-password.
- Auth/session frontend: login screen, refresh-cookie hydration, JWT interceptor, route guards, admin guard.
- User directory backend: authenticated user list and user detail.
- Admin users: admin-only user list, activation/deactivation, global role changes, last-active-admin guard; frontend screen is wired.
- Projects: backend list/create/get/update/status/delete with rich fields and default board columns; frontend supports list/create/detail navigation, edit, status change, and delete with accessible confirmation, plus links to board/members.
- Project members: backend and frontend list/add/change role/remove, including self-removal confirmation.
- Work items / Kanban: backend CRUD plus move between/within columns; frontend board lists cards, supports drag/drop move, and create/edit/delete via an overlay detail panel.
- Role-permission matrix: backend dense role/permission seed, admin read/update, optimistic concurrency, authorization cache reload; frontend matrix screen is wired.
- API contract: `api/openapi.yaml` covers the implemented path families at a high level.

Pending or partial for portfolio readiness:

- Frontend UI for registration, forgot password, and reset password.
- Backlog, sprints, dashboard/metrics, comments/activity feed, profile/change-password, and AI-assisted planning features.
- Demo polish: seeded/demo data, screenshots/GIFs, portfolio-friendly feature tour, and deployment notes.
- OpenAPI drift cleanup before making contract drift checks blocking in CI.
- E2E responsive-overflow coverage (`frontend/e2e/`) only guards horizontal-overflow regressions on the routes/viewport it checks — not a general accessibility or cross-browser suite.

Frontend validation: 240 tests pass. The production build passes with a pre-existing `board.component.ts` stylesheet budget warning.

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

**Backend package layout** (`backend/src/main/java/com/flowpilot/`): `config`, `controller`, `dto`, `entity`, `exception`, `mapper`, `repository`, `security`, `service` — layered, not hexagonal. MapStruct is wired into the Maven compiler plugin; mapper/config packages currently remain light.

**Auth flow**: Login authenticates via Spring's `AuthenticationManager`, then issues two artifacts: a short-lived (15 min) stateless HS256 JWT access token in the response body (`JwtService`, jjwt 0.12.6), and an opaque, DB-backed refresh token (7-day TTL) as an `HttpOnly; Secure; SameSite=Lax` cookie scoped to `/api/auth` (`CookieService` + `RefreshTokenService`) — only the SHA-256 hash is persisted. `JwtAuthenticationFilter` validates the bearer token on every non-`/api/auth/**` request without touching the DB — a deliberate MVP tradeoff meaning a deactivated user's already-issued access token stays valid until it naturally expires. Because the refresh cookie rides automatically on cross-site requests, `/api/auth/refresh` and `/api/auth/logout` are protected by a custom double-submit CSRF filter (`CsrfProtectionFilter`) instead of Spring Security's built-in CSRF, which is fully disabled: a non-HttpOnly `XSRF-TOKEN` cookie is set alongside the refresh cookie and must be echoed back as an `X-XSRF-TOKEN` header. `RefreshTokenService.rotate()` does rotation-with-reuse-detection: presenting an already-revoked refresh token revokes *all* of that user's active refresh tokens. All errors funnel through `GlobalExceptionHandler` as RFC 7807 `ProblemDetail` responses. Password reset token delivery is still MVP-grade; wire real email delivery before production use.

**Domain slices**: Project/member/work-item writes are guarded by project role permissions through `ProjectAuthorizationService`. Admin screens use separate admin-only endpoints for global user management and role-permission matrix management. Work item move uses board-column validation and position calculation so cards can move across columns and within a column.

**Migrations** (`backend/src/main/resources/db/migration/`):
- `V1__users_and_auth.sql` — users, refresh tokens, password reset tokens.
- `V2__seed_admin.sql` — bootstrap admin `admin@flowpilot.local` / `ChangeMe123!` for local/dev only; rotate in real environments.
- `V3__projects_and_columns.sql` — projects and default board columns.
- `V4__project_members.sql` — project membership.
- `V5__work_items.sql` — work items.
- `V6__role_permissions.sql` and `V7__seed_role_permissions.sql` — project role-permission matrix.
- `V8__project_rich_fields.sql` — project code, dates, technologies, repository URL, and related fields.

Flyway requires the `spring-boot-starter-flyway` dependency (not just `flyway-core`) to auto-run on startup in Spring Boot 4.

**Config profiles**: base `application.yml` holds shared defaults; `application-dev.yml`, `application-docker.yml` (datasource host `db`, the Compose service name), `application-prod.yml`, and test's `application-test.yml` override only what differs (datasource, JWT secret, logging). The `docker` profile has no insecure JWT-secret fallback — Compose fails fast if `FLOWPILOT_JWT_SECRET` isn't set. The `prod` profile requires `FLOWPILOT_DATASOURCE_URL`, `FLOWPILOT_DATASOURCE_USERNAME`, `FLOWPILOT_DATASOURCE_PASSWORD`, and `FLOWPILOT_JWT_SECRET` as env vars with no defaults — Spring fails fast at startup if any are missing.

**Frontend**: standalone Angular app with implemented routes for `/`, `/login`, `/projects`, `/projects/:projectId/board`, `/projects/:projectId/members`, `/admin/users`, and `/admin/permissions`. Core auth/API code lives under `frontend/src/app/core/`; feature slices live under `frontend/src/app/features/`; shared UI components live under `frontend/src/app/shared/ui/`. Current frontend gaps are mostly screens for backend capabilities that already exist: auth recovery/register and project mutation/detail.

**API contract**: `api/openapi.yaml` is the hand-authored, contract-first source of truth — write the spec before the controller, not the other way around. The contract is currently monolithic; `api/components/` and `api/paths/` are not populated. CI exports the live Springdoc spec during backend tests and runs a non-blocking `oasdiff` breaking-change report. Known DTO/schema drift remains pending; make the gate blocking only after those gaps are resolved.

**Delivery model**: one Git branch/PR per SDD task-slice, stacked toward `main` where practical. CI (`.github/workflows/ci.yml`) runs backend (`./mvnw -B test`, JDK 25) and frontend (`npm ci && ng test --watch=false && ng build`, Node 22) as separate parallel jobs on every PR and push to `main`.
