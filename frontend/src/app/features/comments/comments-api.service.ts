import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ActivityEvent, Comment, CommentPage, CommentRequest } from './comments.model';

@Injectable({ providedIn: 'root' })
export class CommentsApiService {
  private readonly http = inject(HttpClient);

  listProject(projectId: number, page: CommentPage = {}): Observable<Comment[]> {
    return this.http.get<Comment[]>(`/api/projects/${projectId}/comments`, { params: params(page) });
  }
  createProject(projectId: number, request: CommentRequest): Observable<Comment> {
    return this.http.post<Comment>(`/api/projects/${projectId}/comments`, request);
  }
  listWorkItem(workItemId: number, page: CommentPage = {}): Observable<Comment[]> {
    return this.http.get<Comment[]>(`/api/work-items/${workItemId}/comments`, { params: params(page) });
  }
  createWorkItem(workItemId: number, request: CommentRequest): Observable<Comment> {
    return this.http.post<Comment>(`/api/work-items/${workItemId}/comments`, request);
  }
  update(commentId: number, request: CommentRequest): Observable<Comment> {
    return this.http.put<Comment>(`/api/comments/${commentId}`, request);
  }
  listActivity(projectId: number, page: CommentPage = {}): Observable<ActivityEvent[]> {
    return this.http.get<ActivityEvent[]>(`/api/projects/${projectId}/activity`, { params: params(page) });
  }
}

function params(page: CommentPage): HttpParams {
  let result = new HttpParams();
  if (page.limit !== undefined) result = result.set('limit', page.limit);
  if (page.offset !== undefined) result = result.set('offset', page.offset);
  return result;
}
