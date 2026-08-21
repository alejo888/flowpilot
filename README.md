# FlowPilot

FlowPilot is an AI-assisted agile project management platform — a personal portfolio project built to demonstrate a production-shaped full-stack setup: a layered Spring Boot backend, a standalone Angular frontend, contract-first API design, and a CI pipeline that actually runs the test suites.

Full product vision: [`FlowPilot_Gestor_Proyectos_IA.md`](FlowPilot_Gestor_Proyectos_IA.md) (broader than the current MVP below).

## Screenshots

| | |
|---|---|
| **Login** | **Home** |
| ![Login screen](docs/screenshots/login.png) | ![Home screen](docs/screenshots/00-home.png) |
| **Projects** | **Kanban board** |
| ![Projects list](docs/screenshots/01-projects.png) | ![Kanban board](docs/screenshots/02-board.png) |
| **Project members** | **Admin — users** |
| ![Project members](docs/screenshots/03-members.png) | ![Admin users](docs/screenshots/04-admin-users.png) |
| **Admin — role/permission matrix** | |
| ![Admin role-permission matrix](docs/screenshots/05-admin-permissions.png) | |

## What's implemented

- **Auth & session**: register, login, refresh-token rotation with reuse detection, logout, forgot-password, reset-password — backed by short-lived JWT access tokens plus an `HttpOnly` refresh cookie, and a double-submit CSRF filter protecting the refresh/logout endpoints.
- **User directory & admin**: authenticated user listing, admin-only user management (activate/deactivate, global role changes, last-active-admin guard).
- **Projects**: full CRUD with rich fields (code, dates, technologies, repository URL), status transitions, and per-project default Kanban columns.
- **Project members**: add/remove/change role, including a confirmed self-removal flow.
- **Kanban board**: work-item CRUD, drag-and-drop move between and within columns.
- **Role-permission matrix**: a dense, project-role × permission grid, editable by admins with optimistic-concurrency protection.
- **Spanish-localized errors**: auth, projects, members, board, and admin error/validation messages are translated end-to-end (see [`CLAUDE.md`](CLAUDE.md) for the few remaining English-only paths).
- **API contract**: [`api/openapi.yaml`](api/openapi.yaml) is hand-authored and contract-first, with a CI job that diffs it against the live-generated spec for breaking changes.

See [`CLAUDE.md`](CLAUDE.md) for the full current-status breakdown and what's still pending toward a complete MVP (backlog, sprints, dashboard/metrics, AI-assisted planning, etc.).

## Tech stack

- **Backend**: Spring Boot 4, Java 25, Spring Security, jjwt, Flyway, PostgreSQL
- **Frontend**: Angular 21 (standalone components), Vitest for unit tests, Playwright for e2e
- **Infra**: Docker Compose (Postgres + backend + nginx-served frontend), GitHub Actions CI (backend tests, frontend tests + build, e2e)

## Running it locally

Requires Docker and Docker Compose.

```bash
# Create the ignored local environment file and replace every placeholder with local values.
cp .env.example .env
$EDITOR .env
docker compose up --build
```

- Frontend: http://localhost
- Backend API (proxied under `/api` by the frontend, or directly): http://localhost:8080
- Postgres: `localhost:5432`

For production deployment, configuration, backups, rollback, and operational checks, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). The Compose instructions above remain the local quick start.

On first boot, Flyway seeds the database with demo data so the app isn't empty:

| Email | Password | Role |
|---|---|---|
| `admin@flowpilot.local` | `ChangeMe123!` | Administrador |
| `ana.garcia@flowpilot.local` | `Demo1234!` | Miembro del equipo |
| `carlos.fernandez@flowpilot.local` | `Demo1234!` | Miembro del equipo |
| `lucia.martinez@flowpilot.local` | `Demo1234!` | Miembro del equipo |
| `diego.torres@flowpilot.local` | `Demo1234!` | Miembro del equipo |

These are local/dev-only bootstrap credentials — rotate them before any real deployment.

### Running the backend or frontend on their own

Backend (from `backend/`):

```bash
./mvnw spring-boot:run   # requires JAVA_HOME pointed at a JDK 25
./mvnw -B test           # full test suite
```

Frontend (from `frontend/`):

```bash
npm ci
ng serve   # dev server
ng test --watch=false   # unit tests
ng build   # production build
```

## Repository layout

| Path | Purpose |
|---|---|
| `backend/` | Spring Boot 4 layered monolith, Maven, Flyway migrations, Testcontainers-backed integration coverage. |
| `frontend/` | Angular 21 standalone-components app with auth, admin, projects, members, and board slices. |
| `api/openapi.yaml` | Hand-authored OpenAPI contract for implemented API path families. |
| `docker-compose.yml` | Local stack: PostgreSQL, backend, frontend/nginx. |
| `.github/workflows/ci.yml` | CI for backend tests, frontend tests/build, and e2e. |
| `docs/screenshots/` | Screenshots used in this README. |
| `FlowPilot_Gestor_Proyectos_IA.md` | Full Spanish product vision; broader than the current MVP. |

## Architecture notes

- **Layered backend**, not hexagonal: `config`, `controller`, `dto`, `entity`, `exception`, `mapper`, `repository`, `security`, `service`.
- **Auth flow**: `AuthenticationManager`-based login issues a 15-minute stateless JWT (body) plus a 7-day opaque, DB-backed refresh token (`HttpOnly` cookie). Refresh-token rotation detects reuse and revokes all of a user's active tokens if it happens. All errors funnel through a global `@RestControllerAdvice` as RFC 7807 `ProblemDetail` responses.
- **Authorization**: project role permissions are enforced through `ProjectAuthorizationService` against a dense role/permission matrix; admin screens use separate admin-only endpoints for global user and permission-matrix management.
- **Migrations**: `backend/src/main/resources/db/migration/` — see `CLAUDE.md` for the migration-by-migration breakdown.

For the deeper contributor-facing guide (commands, config profiles, delivery model), see [`CLAUDE.md`](CLAUDE.md).
