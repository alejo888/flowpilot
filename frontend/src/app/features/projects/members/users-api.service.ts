import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { UserSummary } from './user-summary.model';

/**
 * Thin HTTP client for the auth-only user directory (spec:
 * project-members-ui; design D1). Feature-local under
 * `features/projects/members/`, NOT `core/api/` — exactly one consumer today
 * (the add-member picker), following `BoardApiService`'s colocation
 * precedent. Deliberately distinct from `AdminUsersApiService`: that service
 * hits the admin-gated `/api/admin/users` and returns a different DTO
 * (`AdminUser` with `role`/`active`); this one hits the auth-only
 * `/api/users` and returns `UserSummary`, so a non-admin caller is never
 * blocked by an admin-only gate just to see the picker.
 */
@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);

  listUsers(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>('/api/users');
  }
}
