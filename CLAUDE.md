# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FlowPilot — an AI-assisted agile project management platform intended as a personal portfolio project. Full product vision lives in `FlowPilot_Gestor_Proyectos_IA.md`; that document is broader than the current MVP. Backend: Spring Boot 4 (Java 25). Frontend: Angular 21 (standalone components). Database: PostgreSQL via Flyway. Shipped as Docker Compose services.

## Current MVP status

Implemented and covered by backend/frontend tests at a high level:

- Auth/session backend: register, login, refresh-token rotation, logout, forgot-password, reset-password.
- Auth/session frontend: login/register/forgot-password/reset-password screens, refresh-cookie hydration, JWT interceptor, route guards, admin guard.
- User directory backend: authenticated user list and user detail.
- Admin users: admin-only user list, activation/deactivation, global role changes, last-active-admin guard; frontend screen is wired.
- Projects: backend list/create/get/update/status/delete with rich fields and default board columns; frontend supports list/create/detail navigation, edit, status change, and delete with accessible confirmation, plus links to board/members. `/projects/:projectId` renders a project-detail screen with embedded comments and activity feed sections.
- Project members: backend and frontend list/add/change role/remove, including self-removal confirmation.
- Work items / Kanban: backend CRUD plus move between/within columns; frontend board lists cards, supports drag/drop move, and create/edit/delete via an overlay detail panel.
- Backlog and sprints: project backlog browsing and sprint planning with work-item assignment.
- Role-permission matrix: backend dense role/permission seed, admin read/update, optimistic concurrency, authorization cache reload; frontend matrix screen is wired.
- Own profile: backend `GET /api/users/me` and `PUT /api/users/me/password` (verifies the current password, re-hashes, revokes all of the caller's active refresh tokens — mirrors `PasswordResetService`); frontend `/profile` screen shows name/email and a change-password form, reachable from a "Perfil" nav link for any authenticated user.
- Dashboard/metrics: backend `GET /api/projects/{projectId}/dashboard` (`ProjectDashboardService`) returns per-column counts, sprint summary, and per-assignee workload; frontend `/projects/:projectId/dashboard` renders totals, backlog pending count, per-column flow, priority distribution, active sprint progress, and assignee workload.
- Comments and project activity feed: backend supports project-scoped and work-item-scoped comments (create/read/update — **no delete endpoint yet**) plus an authorization-checked project activity feed (`CommentController`, `ProjectActivityService`); frontend renders both in the project-detail screen's comments and activity sections.
- API contract: `api/openapi.yaml` covers the implemented path families at a high level.
- Demo data: `V9__seed_demo_data.sql` seeds 4 demo users (`Demo1234!`) plus 3 projects with members and work items, so a fresh `docker compose up --build` isn't empty. Root `README.md` has screenshots, the demo credential table, and a feature tour.

Pending or partial for portfolio readiness:

- AI-assisted planning features — entirely unimplemented; no AI/LLM integration exists anywhere in the codebase yet.
- Comment deletion — comments support create/read/update only, no delete endpoint or UI action.
- E2E responsive-overflow coverage (`frontend/e2e/`) only guards horizontal-overflow regressions on the routes/viewport it checks — not a general accessibility or cross-browser suite.
- Error/success message translation to Spanish now covers auth (login, register, forgot-password, reset-password) plus projects, project members, work-items/board, admin (users, role-permissions), and profile/change-password. Refresh-token/logout error details (`RefreshTokenService`) and the CSRF-filter error still relay English text and remain pending, along with the Jakarta-default validation-message path in `GlobalExceptionHandler.handleConstraintViolation` for any constraint without an explicit `message=`.

Frontend validation: 352 tests pass. Backend: 243 tests pass. The production build passes cleanly, with no `anyComponentStyle` warnings.

## Commands

Backend (from `backend/`):
- `./mvnw -B test` — full test suite (what CI runs)
- `./mvnw test -Dtest=ClassName` — single test class
- `./mvnw spring-boot:run` — run the app locally
- No `.mvn/jvm.config` pins the JDK. If your machine's default `JAVA_HOME` resolves to an older JDK (e.g. 17), export a JDK 25 `JAVA_HOME` before invoking `./mvnw` — there is no repo-level workaround yet.
- Integration tests use Testcontainers 1.21.2 and require Docker. The full suite includes `FlowpilotApplicationTests`, `AuthFlowIntegrationTest`, `OpenApiSpecExportTest`, and `RolePermissionSeedIntegrationTest`; they won't run in a Docker-less sandbox. Exclude them with `-Dtest='!FlowpilotApplicationTests,!AuthFlowIntegrationTest,!OpenApiSpecExportTest,!RolePermissionSeedIntegrationTest'` when Docker isn't available.
- If Testcontainers cannot discover Docker on a Windows developer machine, use the local configuration files `~/.testcontainers.properties` (with `docker.host`) and `~/.docker-java.properties` (with `api.version`) as troubleshooting overrides. Create them only when discovery fails; do not commit machine-specific named-pipe or API-version settings to the repository.

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
- `V9__seed_demo_data.sql` — demo users and projects (see MVP status above).
- `V10__sprints_and_work_item_assignment.sql` — `sprints` table (name, goal, dates, status, unique-active-per-project constraint) plus `sprint_id` FK on `work_items`.
- `V11__work_item_priority.sql` — `priority` column on `work_items` (LOW/MEDIUM/HIGH/URGENT, default MEDIUM).
- `V12__comments_and_project_activity.sql` — `comments` table (project- or work-item-scoped, author, content up to 4000 chars) and `project_activity` table (actor, event type, display text, JSON payload).
- `V13__seed_comment_permission.sql` — seeds `COMMENT_CREATE` role-permission grants for PROJECT_MANAGER, PRODUCT_OWNER, DEVELOPER, UX_UI_DESIGNER, QA, DEVOPS.

Flyway requires the `spring-boot-starter-flyway` dependency (not just `flyway-core`) to auto-run on startup in Spring Boot 4.

**Config profiles**: base `application.yml` holds shared defaults; `application-dev.yml`, `application-docker.yml` (datasource host `db`, the Compose service name), `application-prod.yml`, and test's `application-test.yml` override only what differs (datasource, JWT secret, logging). The `docker` profile has no insecure JWT-secret fallback — Compose fails fast if `FLOWPILOT_JWT_SECRET` isn't set. The `prod` profile requires `FLOWPILOT_DATASOURCE_URL`, `FLOWPILOT_DATASOURCE_USERNAME`, `FLOWPILOT_DATASOURCE_PASSWORD`, and `FLOWPILOT_JWT_SECRET` as env vars with no defaults — Spring fails fast at startup if any are missing.

**Frontend**: standalone Angular app with implemented routes for `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/projects`, `/projects/:projectId`, `/projects/:projectId/dashboard`, `/projects/:projectId/board`, `/projects/:projectId/backlog`, `/projects/:projectId/members`, `/profile`, `/admin/users`, and `/admin/permissions`. Core auth/API code lives under `frontend/src/app/core/`; feature slices live under `frontend/src/app/features/`; shared UI components live under `frontend/src/app/shared/ui/`. Remaining gap: AI-assisted planning has no backend capability yet, so there's no screen for it either.

**API contract**: `api/openapi.yaml` is the hand-authored, contract-first source of truth — write the spec before the controller, not the other way around. The contract is currently monolithic; `api/components/` and `api/paths/` are not populated. CI exports the live Springdoc spec during backend tests and runs a blocking `oasdiff` breaking-change report (`fail-on: ERR`) — keep the manual spec's request/response schemas (including `format`/`nullable`) aligned with what Springdoc actually generates to avoid false breaking-change failures.

**Delivery model**: one Git branch/PR per SDD task-slice, stacked toward `main` where practical. CI (`.github/workflows/ci.yml`) runs backend (`./mvnw -B test`, JDK 25) and frontend (`npm ci && ng test --watch=false && ng build`, Node 24) as separate parallel jobs on every PR and push to `main`.
