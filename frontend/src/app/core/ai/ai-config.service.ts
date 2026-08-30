import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, inject, signal } from '@angular/core';

/** Mirrors the backend's AiConfigResponse (GET /api/ai/config). */
interface AiConfigResponse {
  enabled: boolean;
}

/**
 * Root singleton that tracks whether the backend's AI assistant is available
 * (`flowpilot.ai.enabled`). Fail-closed: {@link aiEnabled} stays `false` until a
 * successful `/api/ai/config` response says otherwise, so a missing/failed
 * config call never reveals the AI entrypoint. Re-fetched by the app shell
 * whenever the session becomes authenticated.
 */
@Injectable({ providedIn: 'root' })
export class AiConfigService {
  private readonly http = inject(HttpClient);
  private readonly enabledSignal = signal(false);
  /** Non-null only while a `/api/ai/config` request is in flight (de-dupe). */
  private inFlight: Promise<boolean> | null = null;
  /** True once a config response (success or error) has settled at least once. */
  private settled = false;

  readonly aiEnabled: Signal<boolean> = this.enabledSignal.asReadonly();

  /**
   * Fetches `/api/ai/config` unless a request is already in flight. Resolves
   * with the resolved flag; fail-closed, so any error resolves `false` and
   * leaves {@link aiEnabled} `false`. Returning a promise lets the route guard
   * await a definitive answer; the app shell can still call it fire-and-forget.
   */
  load(): Promise<boolean> {
    if (this.inFlight) {
      return this.inFlight;
    }
    this.inFlight = new Promise<boolean>((resolve) => {
      this.http.get<AiConfigResponse>('/api/ai/config').subscribe({
        next: (response) => {
          const enabled = response?.enabled === true;
          this.enabledSignal.set(enabled);
          this.settled = true;
          this.inFlight = null;
          resolve(enabled);
        },
        error: () => {
          this.enabledSignal.set(false);
          this.settled = true;
          this.inFlight = null;
          resolve(false);
        },
      });
    });
    return this.inFlight;
  }

  /**
   * Resolves with the current AI-enabled flag, triggering a one-time load if
   * `/api/ai/config` has never been fetched (a hard navigation straight to the
   * AI route can beat the app shell's own fetch). Fail-closed on error.
   */
  whenLoaded(): Promise<boolean> {
    if (this.settled) {
      return Promise.resolve(this.enabledSignal());
    }
    return this.load();
  }
}
