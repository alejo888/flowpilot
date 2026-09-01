/**
 * AI subtask-generation models. Mirror the backend contract in
 * `api/openapi.yaml` (GenerateSubtasksRequest / GeneratedSubtasksResponse /
 * SubtaskDraft). The draft list is never persisted server-side — it is only
 * turned into real work items once the user confirms (PR 3b, via the
 * transactional batch create endpoint).
 */
export type AiProvider = 'STUB' | 'OLLAMA';

/**
 * Request body for `POST /api/projects/{projectId}/ai/subtasks`. Exactly one of
 * `workItemId` (mode a — an existing story) XOR `storyText` (mode b — free text)
 * must be provided; the backend rejects both-present and both-absent with a
 * Spanish 400.
 */
export interface GenerateSubtasksRequest {
  workItemId?: number | null;
  storyText?: string | null;
}

export interface SubtaskDraft {
  title: string;
  description: string;
}

export interface GeneratedSubtasksResponse {
  subtasks: SubtaskDraft[];
  generatedBy: AiProvider;
  /** Ollama model name for an OLLAMA draft, `null` for a STUB draft. */
  model: string | null;
}

/** One subtask line of a {@link WorkItemBatchCreateRequest} (`subtasks[i]`). */
export interface BatchWorkItemLine {
  title: string;
  description?: string | null;
  acceptanceCriteria?: string[];
}

/**
 * Request body for `POST /api/projects/{projectId}/work-items/batch` — the
 * transactional all-or-nothing batch create the confirm step calls (PR 3b).
 * `columnId` and `subtasks` (1..10) are required. `parentWorkItemId`,
 * `sprintId` and the `aiGenerated`/`aiModel` provenance are batch-level: one
 * confirm action has one parent, one sprint and one provenance, applied to
 * every created row.
 */
export interface WorkItemBatchCreateRequest {
  columnId: number;
  parentWorkItemId?: number | null;
  sprintId?: number | null;
  aiGenerated?: boolean;
  aiModel?: string | null;
  subtasks: BatchWorkItemLine[];
}
