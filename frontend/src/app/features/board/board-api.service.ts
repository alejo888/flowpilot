import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  BoardColumn,
  WorkItem,
  WorkItemCreateRequest,
  WorkItemMoveRequest,
  WorkItemUpdateRequest,
} from './board.model';

/**
 * Thin HTTP client for the kanban board (spec: kanban-board). Uses relative
 * `/api/...` paths per design D8 (same-origin reverse proxy in Docker;
 * `proxy.conf.json` proxies `/api` to `localhost:8080` for local
 * `ng serve`).
 */
@Injectable({ providedIn: 'root' })
export class BoardApiService {
  private readonly http = inject(HttpClient);

  getBoardColumns(projectId: number): Observable<BoardColumn[]> {
    return this.http.get<BoardColumn[]>(`/api/projects/${projectId}/board-columns`);
  }

  getWorkItems(projectId: number): Observable<WorkItem[]> {
    return this.http.get<WorkItem[]>(`/api/projects/${projectId}/work-items`);
  }

  createWorkItem(projectId: number, request: WorkItemCreateRequest): Observable<WorkItem> {
    return this.http.post<WorkItem>(`/api/projects/${projectId}/work-items`, request);
  }

  getWorkItem(itemId: number): Observable<WorkItem> {
    return this.http.get<WorkItem>(`/api/work-items/${itemId}`);
  }

  updateWorkItem(itemId: number, request: WorkItemUpdateRequest): Observable<WorkItem> {
    return this.http.put<WorkItem>(`/api/work-items/${itemId}`, request);
  }

  deleteWorkItem(itemId: number): Observable<void> {
    return this.http.delete<void>(`/api/work-items/${itemId}`);
  }

  moveWorkItem(itemId: number, request: WorkItemMoveRequest): Observable<WorkItem> {
    return this.http.put<WorkItem>(`/api/work-items/${itemId}/move`, request);
  }
}
