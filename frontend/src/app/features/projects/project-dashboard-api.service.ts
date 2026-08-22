import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ProjectDashboard } from './project-dashboard.model';

@Injectable({ providedIn: 'root' })
export class ProjectDashboardApiService {
  private readonly http = inject(HttpClient);
  get(projectId: number): Observable<ProjectDashboard> { return this.http.get<ProjectDashboard>(`/api/projects/${projectId}/dashboard`); }
}
