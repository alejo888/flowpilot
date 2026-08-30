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
      /** Id of the parent work item this item is a subtask of; null/undefined when it is top-level. */
      parentWorkItemId?: number | null;
      /** Title of the parent work item (backend-derived), when this item has a parent. */
      parentWorkItemTitle?: string | null;
      /** Number of direct children (backend `COUNT`); `0`/undefined when the item is a leaf. */
      childCount?: number;
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
      /** Optional/additive: link the new item to a parent work item (single-level hierarchy). */
      parentWorkItemId?: number | null;
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
      /**
       * Set, change (a number) or clear (`null`) the item's parent link.
       * Every partial PUT MUST round-trip the item's current value: the
       * backend update setter is unconditional, so an omitted field is read
       * as "clear the parent" (mirrors `sprintId`).
       */
      parentWorkItemId?: number | null;
      /**
       * Ordered acceptance criteria. Same unconditional-setter hazard as
       * `parentWorkItemId`: a partial PUT that omits this wipes an
       * AI-generated story's criteria, so callers must round-trip it.
       */
      acceptanceCriteria?: string[];
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
