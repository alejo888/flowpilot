/**
 * Board domain models (spec: kanban-board). Mirror the backend's
 * BoardColumnResponse / WorkItemResponse shapes (api/openapi.yaml).
 */
export interface BoardColumn {
  id: number;
  name: string;
  position: number;
}

export interface WorkItem {
  id: number;
  projectId: number;
  columnId: number;
  title: string;
  description: string | null;
  assignedUserId: number | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** Request body for POST /api/projects/{projectId}/work-items. */
export interface WorkItemCreateRequest {
  title: string;
  description?: string | null;
  assignedUserId?: number | null;
}

/** Request body for PUT /api/work-items/{id}. */
export interface WorkItemUpdateRequest {
  title: string;
  description?: string | null;
  assignedUserId?: number | null;
}

/**
 * Request body for PUT /api/work-items/{id}/move. `position` is the
 * zero-based insertion index within the target column's OTHER items (the
 * moved item itself excluded) — the backend translates it into a gap-based
 * position value (design D10).
 */
export interface WorkItemMoveRequest {
  columnId: number;
  position: number;
}
