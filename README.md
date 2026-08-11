# FlowPilot

FlowPilot is a lightweight project/task management MVP: Spring Boot 4 (Java 25) backend, Angular (standalone components) frontend, PostgreSQL, delivered as Docker Compose services.

## Repository layout

- `backend/` — Spring Boot 4.x layered monolith (Java 25), Maven, Flyway migrations.
- `frontend/` — Angular standalone-components app.
- `api/openapi.yaml` — hand-authored, contract-first REST API spec (source of truth).
- `docker-compose.yml` — local/dev stack: Postgres, backend, frontend (nginx).
- `.github/workflows/ci.yml` — CI: backend tests, frontend tests, OpenAPI lint/drift.

## Local development

```bash
docker compose up --build
```

Backend: `http://localhost:8080` (proxied under `/api` through the frontend nginx container).
Frontend: `http://localhost:80`.

## Status

This repository is being built slice-by-slice following an SDD (spec-driven development) process. See the project's SDD artifacts for the full task breakdown. This is PR0 (bootstrap): repo scaffolding, skeleton backend/frontend, baseline DB migration with a seeded admin account, and CI/test-runner setup. No application routes ship yet — that begins with Auth in PR1.
