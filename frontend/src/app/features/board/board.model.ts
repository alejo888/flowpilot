/**
 * Board domain models (spec: kanban-board). Mirror the backend's
 * BoardColumnResponse / WorkItemResponse shapes (api/openapi.yaml).
 */
export interface BoardColumn {
  id: number;
  name: string;
  position: number;
}

/** Mirrors the backend's WorkItemPriority enum (LOW/MEDIUM/HIGH/URGENT). */
export type WorkItemPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface WorkItem {
  id: number;
  projectId: number;
  columnId: number;
  title: string;
  description: string | null;
  assignedUserId: number | null;
  assignedUserName: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
      sprintId?: number | null;
      priority?: WorkItemPriority;
      /** Ordered structured acceptance criteria (backend `acceptance_criteria` jsonb). */
      acceptanceCriteria?: string[];
      /** True when the item was created from a confirmed AI-generated draft. */
      aiGenerated?: boolean;
      /** Model name the client asserted for an AI-confirmed create; null otherwise. */
      aiModel?: string | null;
      /**
       * Populated ONLY on the response of PUT /api/work-items/{id}/move
       * when the gap-based position strategy ran out of room and
       * re-sequenced every sibling in the target column (design D10) —
       * absent/null for every other response, including a move that didn't
       * trigger a resequence. {@link BoardStore.moveItem} applies these to
       * local state instead of just the moved item so siblings never go
       * stale until a full reload.
       */
      affectedItems?: WorkItem[] | null;
}

/** Request body for POST /api/projects/{projectId}/work-items. */
export interface WorkItemCreateRequest {
  title: string;
  description?: string | null;
  assignedUserId?: number | null;
      sprintId?: number | null;
      priority?: WorkItemPriority | null;
      /** Optional/additive: ordered acceptance criteria to persist with the item. */
      acceptanceCriteria?: string[];
      /** Optional/additive: client-asserted provenance for an AI-confirmed create. */
      aiGenerated?: boolean;
      aiModel?: string | null;
}

/** Request body for PUT /api/work-items/{id}. */
export interface WorkItemUpdateRequest {
  title: string;
  description?: string | null;
  assignedUserId?: number | null;
      sprintId?: number | null;
      priority?: WorkItemPriority | null;
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
