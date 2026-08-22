import { WorkItem, WorkItemUpdateRequest } from '../board/board.model';

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export interface Sprint {
  id: number;
  projectId: number;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SprintRequest {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
}

export type BacklogWorkItem = WorkItem;
export type BacklogWorkItemUpdate = WorkItemUpdateRequest & { sprintId?: number | null };
