import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AdminUser, UserRoleUpdateRequest, UserStatusUpdateRequest } from './admin-user.model';

/**
 * Thin HTTP client for admin-only user management (spec:
 * user-administration). Uses relative `/api/...` paths per design D8
 * (same-origin reverse proxy in Docker; `proxy.conf.json` proxies `/api` to
 * `localhost:8080` for local `ng serve`).
 */
@Injectable({ providedIn: 'root' })
export class AdminUsersApiService {
  private readonly http = inject(HttpClient);

  listUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>('/api/admin/users');
  }

  setStatus(id: number, request: UserStatusUpdateRequest): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`/api/admin/users/${id}/status`, request);
  }

  changeRole(id: number, request: UserRoleUpdateRequest): Observable<AdminUser> {
    return this.http.put<AdminUser>(`/api/admin/users/${id}/role`, request);
  }
}
