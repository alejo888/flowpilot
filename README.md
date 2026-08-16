# FlowPilot

FlowPilot is a portfolio-oriented agile project management MVP. The current build demonstrates a secured Spring Boot 4 / Java 25 backend, an Angular 21 frontend, PostgreSQL persistence, Docker Compose packaging, and an OpenAPI contract workflow. It is not the full AI-assisted product vision yet; this README focuses on what is implemented and what remains pending.

## Quick demo path

1. Start the stack:

   ```bash
   # Set a strong local secret first; do not commit it.
   export FLOWPILOT_JWT_SECRET="replace-with-a-long-local-secret"
   docker compose up --build
   ```

2. Open the frontend at `http://localhost:80`.
3. Sign in with the local seeded admin account: `admin@flowpilot.local` / `ChangeMe123!`.
4. Review the implemented flows:
   - Admin users: list users, activate/deactivate, change global roles.
   - Role permissions: update the project role-permission matrix.
   - Projects: list, create, open details, edit, change status, and delete projects with accessible confirmation.
   - Project members: add/remove members and change project roles.
   - Kanban board: view columns/cards and drag existing cards between/within columns.

Backend is also exposed at `http://localhost:8080`; the frontend nginx container proxies API calls under `/api`.

## Current MVP status

| Area | Implemented now | Partial / pending |
|------|-----------------|-------------------|
| Auth/session | Backend register, login, refresh-token rotation, logout, forgot/reset password. Frontend login, refresh-cookie hydration, JWT interceptor, route guards, admin guard. | Frontend register, forgot password, and reset password screens. |
| Users/admin | Authenticated backend user list/detail. Admin user list, activate/deactivate, role changes, and last-active-admin protection with frontend screens. | Profile and change-password UI. |
| Projects | Backend list/create/get/update/status/delete with rich fields and default board columns. Frontend supports list/create/detail navigation, edit, status change, and delete with accessible confirmation. | — |
| Project members | Backend and frontend list/add/change role/remove, including self-removal confirmation. | Portfolio polish around empty states/demo data. |
| Work items/Kanban | Backend work-item CRUD and move. Frontend board lists existing cards and supports drag/drop moves. | Frontend work-item create/edit/delete/detail. |
| Permissions | Backend and frontend admin role-permission matrix with optimistic concurrency and authorization cache reload. | Broader audit/activity history. |
| API contract/CI | `api/openapi.yaml` covers implemented path families. CI exports live Springdoc spec and runs non-blocking `oasdiff`. | Clean up known OpenAPI drift before making the drift gate blocking. |
| Product vision | Agile project management foundation is underway. | Backlog, sprints, dashboard/metrics, comments/activity feed, AI-assisted planning, screenshots, deployment polish. |

Frontend validation: 240 tests pass. The production build passes with a pre-existing `board.component.ts` stylesheet budget warning.

## Repository layout

| Path | Purpose |
|------|---------|
| `backend/` | Spring Boot 4 layered monolith, Maven, Flyway migrations, Testcontainers-backed integration coverage. |
| `frontend/` | Angular 21 standalone-components app with auth, admin, projects, members, and board slices. |
| `api/openapi.yaml` | Hand-authored OpenAPI contract for implemented API path families. |
| `docker-compose.yml` | Local stack: PostgreSQL, backend, frontend/nginx. |
| `.github/workflows/ci.yml` | CI for backend tests, frontend tests/build, and OpenAPI lint/drift reporting. |
| `FlowPilot_Gestor_Proyectos_IA.md` | Full Spanish product vision; broader than the current MVP. |

## Local development

### Full stack

```bash
export FLOWPILOT_JWT_SECRET="replace-with-a-long-local-secret"
docker compose up --build
```

### Backend

```bash
cd backend
./mvnw -B test
./mvnw spring-boot:run
```

Notes:
- Java 25 is required.
- Some integration tests require Docker/Testcontainers.

### Frontend

```bash
cd frontend
npm ci
npm start
npm test -- --watch=false
npm run build
```

## Portfolio-readiness backlog

- Add frontend screens for registration, password recovery/reset, and work-item create/edit/delete/detail.
- Add product modules that are still vision-only: backlog, sprints, dashboard/metrics, comments/activity feed, profile/change-password, and AI-assisted planning.
- Add demo seed data, screenshots/GIFs, a short feature tour, and deployment notes.
- Resolve OpenAPI schema/DTO drift and make the drift check blocking in CI.

## Scope note

FlowPilot is an MVP intended to show end-to-end product engineering practices. It currently emphasizes secure auth/session handling, role-based administration, project membership, Kanban movement, API contracts, and CI. Production hardening, real email delivery, public deployment, and AI features remain future work.
