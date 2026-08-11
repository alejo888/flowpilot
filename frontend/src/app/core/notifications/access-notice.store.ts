import { Injectable, signal } from '@angular/core';

/**
 * Transient access-denial notice (spec: admin-only route access; design D5 —
 * signal service, not router state or a sticky query param). `adminGuard`
 * calls {@link denyAdmin} before redirecting to `''`; `HomeComponent` reads
 * and {@link consume}s the message exactly once so it does not survive a
 * reload or reappear on a later visit.
 */
@Injectable({ providedIn: 'root' })
export class AccessNoticeStore {
  private readonly messageSignal = signal<string | null>(null);

  readonly message = this.messageSignal.asReadonly();

  denyAdmin(): void {
    this.messageSignal.set('No tienes acceso a esta sección.');
  }

  /** Returns the current message, then clears it so it is shown only once. */
  consume(): string | null {
    const current = this.messageSignal();
    this.messageSignal.set(null);
    return current;
  }
}
