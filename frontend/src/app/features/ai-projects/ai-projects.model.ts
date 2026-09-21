/**
 * AI project creation models (vision 7.4). Mirror the backend contract in
 * `api/openapi.yaml` (ProjectDraftRequest / ProjectDraftResponse /
 * ProjectWithBacklogRequest). The draft is never persisted server-side; it is
 * only turned into a project + backlog once the user confirms via
 * `POST /api/projects/with-backlog`.
 */
export type AiProvider = 'STUB' | 'OLLAMA';

export interface GenerateProjectDraftRequest {
  description: string;
}

export interface ProjectDraftStory {
  title: string;
  description: string | null;
}

export interface ProjectDraftEpic {
  title: string;
  description: string | null;
  stories: ProjectDraftStory[];
}

export interface ProjectDraftResponse {
  name: string;
  description: string;
  technologies: string | null;
  epics: ProjectDraftEpic[];
  generatedBy: AiProvider;
  /** Ollama model name for an OLLAMA draft, `null` for a STUB draft. */
  model: string | null;
}

export interface BacklogStoryRequest {
  title: string;
  description: string | null;
}

export interface BacklogEpicRequest {
  title: string;
  description: string | null;
  stories: BacklogStoryRequest[];
}

export interface ProjectWithBacklogRequest {
  name: string;
  description: string | null;
  code: string | null;
  technologies: string | null;
  epics: BacklogEpicRequest[];
  aiGenerated: boolean;
  aiModel: string | null;
}

/** Editable (string-only) shape of a story/epic while the user reviews the draft. */
export interface StoryEdit {
  title: string;
  description: string;
}

export interface EpicEdit {
  title: string;
  description: string;
  stories: StoryEdit[];
}

/** Backend limits, enforced client-side so the user never hits the 400. */
export const MAX_EPICS = 10;
export const MAX_STORIES_PER_EPIC = 10;
export const MAX_TOTAL_ITEMS = 50;

export function totalItems(epics: EpicEdit[]): number {
  return epics.reduce((sum, epic) => sum + 1 + epic.stories.length, 0);
}

export function canAddEpic(epics: EpicEdit[]): boolean {
  return epics.length < MAX_EPICS && totalItems(epics) < MAX_TOTAL_ITEMS;
}

export function canAddStory(epics: EpicEdit[], epicIndex: number): boolean {
  return (
    (epics[epicIndex]?.stories.length ?? 0) < MAX_STORIES_PER_EPIC &&
    totalItems(epics) < MAX_TOTAL_ITEMS
  );
}

export function hasBlankTitle(epics: EpicEdit[]): boolean {
  return epics.some(
    (epic) => epic.title.trim() === '' || epic.stories.some((story) => story.title.trim() === ''),
  );
}
