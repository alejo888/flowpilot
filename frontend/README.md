# FlowPilot frontend

Angular 21 standalone-components frontend for the FlowPilot MVP. The current UI covers login, protected routing, admin users, role-permission management, project list/create, project members, and a Kanban board that can move existing work items.

## Quick path

```bash
cd frontend
npm ci
npm start
```

Open `http://localhost:4200`. For the full backend/database-backed experience, run the repository stack from the root with `docker compose up --build` and open `http://localhost:80`.

## Implemented UI

| Feature area | Current frontend behavior |
|--------------|---------------------------|
| Auth | Login screen, refresh-cookie hydration, JWT storage, bearer interceptor, protected routes, admin guard. |
| Home/navigation | Entry routes for login, projects, board, members, admin users, and admin permissions. |
| Admin users | User list, activate/deactivate, global role change, last-active-admin guard surfaced through API errors. |
| Role permissions | Admin matrix for reading/updating role permissions with optimistic concurrency handling. |
| Projects | List projects and create projects. |
| Project members | List/add members, change project role, remove members, and confirm self-removal. |
| Kanban board | List board columns/cards and drag existing cards within or across columns. |

## Known frontend gaps

| Area | Pending work |
|------|--------------|
| Auth | Register, forgot password, and reset password screens. |
| Projects | Detail page, edit form, status changes, and delete flow. |
| Work items | Create, edit, delete, and detail views. |
| Product modules | Backlog, sprints, dashboard/metrics, comments/activity feed, profile/change-password, AI-assisted planning. |
| Portfolio polish | Demo data, screenshots/GIFs, deployment notes, refined empty/loading/error states. |

## Project structure

| Path | Purpose |
|------|---------|
| `src/app/core/auth/` | Auth API client, auth store, guards, JWT helpers, XSRF helpers. |
| `src/app/core/api/` | HTTP infrastructure such as the JWT interceptor. |
| `src/app/features/auth/` | Login feature. |
| `src/app/features/projects/` | Project list/create and member management. |
| `src/app/features/board/` | Kanban board API/store/component. |
| `src/app/features/admin-permissions/` | Role-permission matrix state. |
| `src/app/shared/ui/` | Small reusable UI components. |

## Useful commands

```bash
npm start                 # Angular dev server
npm test -- --watch=false # Unit tests via Angular/Vitest
npm run build             # Production build
```

The frontend expects backend API routes under `/api`. Docker/nginx provides that proxy in the full stack; local `ng serve` usage may require the repository's Angular proxy configuration if backend calls are exercised directly.
