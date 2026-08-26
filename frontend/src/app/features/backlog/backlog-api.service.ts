import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { WorkItem, WorkItemUpdateRequest } from '../board/board.model';
import { Sprint, SprintRequest } from './backlog.model';

@Injectable({ providedIn: 'root' })
export class BacklogApiService {
  private readonly http = inject(HttpClient);

  getWorkItems(projectId: number): Observable<WorkItem[]> {
    return this.http.get<WorkItem[]>(`/api/projects/${projectId}/work-items`);
  }

  listSprints(projectId: number): Observable<Sprint[]> {
    return this.http.get<Sprint[]>(`/api/projects/${projectId}/sprints`);
  }

  createSprint(projectId: number, request: SprintRequest): Observable<Sprint> {
    return this.http.post<Sprint>(`/api/projects/${projectId}/sprints`, request);
  }

  startSprint(sprintId: number): Observable<Sprint> {
    return this.http.post<Sprint>(`/api/sprints/${sprintId}/start`, {});
  }

  completeSprint(sprintId: number): Observable<Sprint> {
    return this.http.post<Sprint>(`/api/sprints/${sprintId}/complete`, {});
  }

  updateWorkItemSprint(itemId: number, request: WorkItemUpdateRequest): Observable<WorkItem> {
    return this.http.put<WorkItem>(`/api/work-items/${itemId}`, request);
  }
}
