export interface Comment {
  id: number;
  projectId: number;
  workItemId: number | null;
  authorId: number;
  authorName: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: number;
  projectId: number;
  actorId: number;
  eventType: string;
  displayText: string;
  payload: string | null;
  createdAt: string;
}

export interface CommentRequest { content: string; }
export interface CommentPage { limit?: number; offset?: number; }
