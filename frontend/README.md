# FlowPilot frontend

Angular 21 standalone-components frontend for the FlowPilot MVP. The UI covers the full authenticated product: auth, admin, projects, members, a drag-and-drop Kanban board with a work-item hierarchy, backlog and sprint planning, a project dashboard, comments and an activity feed, your own profile, and three AI-assisted planning slices (all behind an off-by-default flag).

## Quick path

```bash
cd frontend
npm ci
npm start
```

Open `http://localhost:4200`. For the full backend/database-backed experience, run the repository stack from the root with `docker compose up --build` and open `http://localhost`.

## Implemented UI

| Feature area | Current frontend behavior |
|--------------|---------------------------|
| Auth | Login, register, forgot-password, reset-password screens; refresh-cookie hydration, JWT storage, bearer interceptor, route guards, admin guard. |
| Admin users | User list, activate/deactivate, global role change, last-active-admin guard surfaced through API errors. |
| Role permissions | Admin role × permission matrix with optimistic-concurrency handling; per-cell edits no-op while a save is in flight. |
| Projects | List, create, project-detail screen, edit form, status transitions, and an accessible delete-confirmation flow. Destructive/mutating controls are gated on the caller's `callerPermissions` (fail-closed until the project loads). |
| Project members | List, add, change project role, remove, and a confirmed self-removal flow. |
| Kanban board | Work-item CRUD via an overlay detail panel, drag-and-drop move between and within columns (drag itself is disabled without `WORKITEM_MOVE`), single-level parent/child hierarchy (parent `<select>`, child-count badge, delete guarded when the item has children). |
| Backlog & sprints | Backlog browsing and sprint planning with work-item assignment. |
| Dashboard | Per-project metrics: item totals, backlog pending count, per-column flow, priority distribution, active sprint progress, per-assignee workload. |
| Profile | View your own name/email and change your password (revokes your other active sessions). |
| Comments & activity | Threaded comments on projects and work items (create/read/update/delete, author-only edits/deletes) rendered in the project-detail screen and the board work-item panel, plus an authorization-checked project activity feed. |
| AI planning (off by default) | User-story generation (`/projects/:id/ai/user-stories`), subtask generation (`/projects/:id/ai/subtasks`), and acceptance-criteria generation (in the board work-item panel). All gated by `core/ai/AiConfigService` on the `flowpilot.ai.enabled` flag; with the flag off the screens still work against a deterministic stub. |

## Known frontend gaps

| Area | Pending work |
|------|--------------|
| AI planning | Vision-doc slices 7.4–7.7 (AI project creation, AI project manager, risk analysis, story refinement) have no UI. |
| Cross-browser e2e | The Playwright sweep covers static/responsive routes on Chromium/Firefox/WebKit, not every interactive flow on all three engines. |
| Portfolio polish | Continued refinement of empty/loading/error states. |

## Project structure

| Path | Purpose |
|------|---------|
| `src/app/core/auth/` | Auth API client, auth store, guards, JWT helpers, XSRF helpers. |
| `src/app/core/api/` | HTTP infrastructure such as the JWT interceptor. |
| `src/app/core/ai/` | `AiConfigService` — fail-closed signal driving AI-feature gating. |
| `src/app/features/auth/` | Login, register, forgot-password, reset-password. |
| `src/app/features/home/` | Landing screen. |
| `src/app/features/projects/` | Project list/create, project-detail, edit, dashboard, and member management. |
| `src/app/features/board/` | Kanban board API/store/component, work-item detail panel, acceptance-criteria editor. |
| `src/app/features/backlog/` | Backlog browsing and sprint planning. |
| `src/app/features/comments/` | Comments and project activity feed. |
| `src/app/features/profile/` | Own profile and change-password. |
| `src/app/features/admin-users/` | Admin user management. |
| `src/app/features/admin-permissions/` | Role-permission matrix state. |
| `src/app/features/ai-stories/`, `src/app/features/ai-subtasks/` | AI planning slices (7.1 / 7.3). |
| `src/app/shared/ui/` | Small reusable UI components. |

## Useful commands

```bash
npm start                 # Angular dev server
npm test -- --watch=false # Unit tests via Angular/Vitest
npm run build             # Production build
```

The frontend expects backend API routes under `/api`. Docker/nginx provides that proxy in the full stack; local `ng serve` usage may require the repository's Angular proxy configuration if backend calls are exercised directly.
