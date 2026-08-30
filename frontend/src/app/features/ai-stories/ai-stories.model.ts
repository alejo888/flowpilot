/**
 * AI user-story generation models. Mirror the backend contract in
 * `api/openapi.yaml` (GenerateUserStoryRequest / GeneratedUserStoryResponse /
 * UserStoryDraft). The draft is never persisted server-side — it is only turned
 * into a work item once the user confirms via the existing work-item create
 * endpoint.
 */
export type AiProvider = 'STUB' | 'OLLAMA';

export interface GenerateUserStoryRequest {
  requirement: string;
}

export interface UserStoryDraft {
  role: string;
  action: string;
  benefit: string;
  /** Backend-composed Spanish sentence: `Como {role} quiero {action} para {benefit}`. */
  text: string;
}

export interface GeneratedUserStoryResponse {
  userStory: UserStoryDraft;
  acceptanceCriteria: string[];
  generatedBy: AiProvider;
  /** Ollama model name for an OLLAMA draft, `null` for a STUB draft. */
  model: string | null;
}
