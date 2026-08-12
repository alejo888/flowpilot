/**
 * Lightweight user-directory entry (spec: project-members-ui; design D1).
 * Mirrors the backend's `UserSummaryResponse(Long id, String name, String
 * email)` (`UserController` `GET /api/users`, auth-only, no admin gate).
 */
export interface UserSummary {
  id: number;
  name: string;
  email: string;
}
