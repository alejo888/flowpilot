import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BoardColumn, WorkItem, WorkItemMoveRequest } from './board.model';

/**
 * Thin HTTP client for the kanban board (spec: kanban-board). Uses relative
 * `/api/...` paths per design D8 (same-origin reverse proxy in Docker;
 * `proxy.conf.json` for local `ng serve`, not yet wired — known gap outside
 * this slice's scope).
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

  moveWorkItem(itemId: number, request: WorkItemMoveRequest): Observable<WorkItem> {
    return this.http.put<WorkItem>(`/api/work-items/${itemId}/move`, request);
  }
}
