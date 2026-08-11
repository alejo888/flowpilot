import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RolePermissionMatrixResponse, RolePermissionUpdateRequest } from './role-permission.model';

/**
 * Thin HTTP client for the admin-only permission matrix (spec:
 * role-permissions). Uses relative `/api/...` paths per design D8, mirrors
 * `features/admin-users/admin-users-api.service.ts`.
 */
@Injectable({ providedIn: 'root' })
export class RolePermissionsApiService {
  private readonly http = inject(HttpClient);

  getMatrix(): Observable<RolePermissionMatrixResponse> {
    return this.http.get<RolePermissionMatrixResponse>('/api/admin/role-permissions');
  }

  replaceAll(request: RolePermissionUpdateRequest): Observable<RolePermissionMatrixResponse> {
    return this.http.put<RolePermissionMatrixResponse>('/api/admin/role-permissions', request);
  }
}
