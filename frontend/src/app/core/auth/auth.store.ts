import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay } from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { AccessTokenResponse, GlobalRole } from './auth.model';
import { decodeRole, decodeUserId } from './jwt-claims';

interface ProblemDetailLike {
  error?: { detail?: string };
}

/**
 * Signals-based session state (spec: frontend-auth-session; design decision
 * "AuthStore shape and public API" — mirrors {@link BoardStore}'s layout).
 * The access token lives only in memory; the HttpOnly refresh cookie is the
 * durable session artifact, re-hydrated at bootstrap via {@link hydrate}.
 * {@link refresh} is single-flight (shareReplay + finalize) so concurrent
 * 401s from the jwt interceptor trigger exactly one network refresh.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(AuthApiService);

  private readonly accessTokenSignal = signal<string | null>(null);
  private readonly expiresAtSignal = signal<number | null>(null);
  private readonly errorSignal = signal<string | null>(null);
  private readonly roleSignal = signal<GlobalRole | null>(null);
  private refreshInFlight: Observable<string> | null = null;

  readonly accessToken = this.accessTokenSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.accessTokenSignal() !== null);
  readonly role = this.roleSignal.asReadonly();
  readonly isAdmin = computed(() => this.roleSignal() === 'ADMINISTRADOR');
  readonly currentUserId = computed(() => decodeUserId(this.accessTokenSignal()));

  login(email: string, password: string): void {
    this.errorSignal.set(null);
    this.api.login({ email, password }).subscribe({
      next: (response) => this.setSession(response),
      error: (err: unknown) => this.errorSignal.set(this.extractDetail(err)),
    });
  }

  logout(): void {
    this.api.logout().subscribe({
      next: () => this.clear(),
      error: () => this.clear(),
    });
  }

  /** Bootstrap re-hydration. Never throws — any failure resolves to `false`. */
  hydrate(): Observable<boolean> {
    return this.refresh().pipe(
      map(() => true),
      catchError(() => {
        this.clear();
        return of(false);
      }),
    );
  }

  /** Single-flight refresh, shared across concurrent callers (interceptor + hydrate). */
  refresh(): Observable<string> {
    this.refreshInFlight ??= this.api.refresh().pipe(
      map((response) => {
        this.setSession(response);
        return response.accessToken;
      }),
      finalize(() => {
        this.refreshInFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight;
  }

  clear(): void {
    this.accessTokenSignal.set(null);
    this.expiresAtSignal.set(null);
    this.roleSignal.set(null);
  }

  private setSession(response: AccessTokenResponse): void {
    this.errorSignal.set(null);
    this.accessTokenSignal.set(response.accessToken);
    this.expiresAtSignal.set(Date.now() + response.expiresIn * 1000);
    this.roleSignal.set(decodeRole(response.accessToken));
  }

  private extractDetail(err: unknown): string {
    const problem = err as ProblemDetailLike;
    return problem?.error?.detail ?? 'No se pudo iniciar sesión';
  }
}
