import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ChangePasswordRequest, UserProfile } from './profile.model';

/**
 * Thin HTTP client for the caller's own profile (spec: profile). Uses
 * relative `/api/...` paths per the same convention as {@link AdminUsersApiService}.
 * JWT attachment is automatic via the existing bearer interceptor.
 */
@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);

  getCurrentUser(): Observable<UserProfile> {
    return this.http.get<UserProfile>('/api/users/me');
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.put<void>('/api/users/me/password', request);
  }
}
