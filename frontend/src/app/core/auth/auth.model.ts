/**
 * Auth domain models (spec: frontend-auth-session, frontend-http-auth).
 * Mirror the backend's LoginRequest / AccessTokenResponse / ProblemDetail
 * shapes (api/openapi.yaml).
 */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface AccessTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
}
