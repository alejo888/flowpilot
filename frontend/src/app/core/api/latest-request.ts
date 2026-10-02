import { WritableSignal } from '@angular/core';
import { Observable } from 'rxjs';

import { problemDetail } from './problem-detail';

/** How a {@link LatestRequest} run applies its outcome. */
export type LatestRequestOptions<T> = {
  /** Applies the response to store state; only called while the run is still current. */
  onSuccess: (value: T) => void;
} & (
  | {
      /** Spanish message used when the error body carries no RFC 7807 `detail`. */
      fallback: string;
    }
  | {
      /** Custom error handling (e.g. 409 / field errors) instead of setting the error signal. */
      onError: (err: unknown) => void;
    }
);

/**
 * Token-guarded Observable -> `Promise<boolean>` bridge for signals stores.
 *
 * Owns one generation counter: every {@link run} and {@link invalidate} bumps
 * it, and a response only lands while its token still matches. A stale
 * (superseded or invalidated) response resolves `false` and touches no state,
 * so a late reply can never leak a draft, error or busy flag into a newer
 * request, another item or another project.
 *
 * Dropping a run (via {@link invalidate} or a newer {@link run}) also
 * unsubscribes its source, so the underlying HTTP request is cancelled instead
 * of running on unobserved, and resolves the dropped run's promise `false`.
 *
 * {@link invalidate} also clears the busy signal: the dropped request will
 * never clear it itself. The error signal stays the caller's to manage.
 */
export class LatestRequest {
  private generation = 0;
  /** Cancels the pending run (unsubscribe + resolve `false`); null once it settled or was dropped. */
  private cancelInFlight: (() => void) | null = null;

  constructor(
    private readonly busy: WritableSignal<boolean>,
    private readonly error: WritableSignal<string | null>,
  ) {}

  /** Subscribes to `source`; resolves `true` only when its first value landed while still current. */
  run<T>(source: Observable<T>, options: LatestRequestOptions<T>): Promise<boolean> {
    this.dropInFlight();
    const token = ++this.generation;
    this.busy.set(true);
    this.error.set(null);

    return new Promise((resolve) => {
      let settled = false;
      const settle = (apply: () => void, ok: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (token !== this.generation) {
          resolve(false);
          return;
        }
        this.cancelInFlight = null;
        // A throwing callback is a programming error, not a server outcome: log
        // it and resolve `false` (nothing was confirmed as applied) instead of
        // rethrowing, so busy is always cleared and the promise always settles.
        let applied = ok;
        try {
          apply();
        } catch (err: unknown) {
          applied = false;
          console.error('LatestRequest: applying the response failed', err);
        } finally {
          this.busy.set(false);
          resolve(applied);
        }
      };

      const subscription = source.subscribe({
        next: (value) => settle(() => options.onSuccess(value), true),
        error: (err: unknown) =>
          settle(() => {
            if ('onError' in options) {
              options.onError(err);
            } else {
              this.error.set(problemDetail(err, options.fallback));
            }
          }, false),
        complete: () => settle(() => undefined, false),
      });

      // A synchronous source has already settled (and torn down) by now; only a pending one is cancellable.
      if (!settled) {
        this.cancelInFlight = () => {
          settled = true;
          subscription.unsubscribe();
          resolve(false);
        };
      }
    });
  }

  /** Drops any in-flight run (unsubscribes it, resolves it `false`) and clears the busy signal. */
  invalidate(): void {
    this.dropInFlight();
    this.generation++;
    this.busy.set(false);
  }

  private dropInFlight(): void {
    const cancel = this.cancelInFlight;
    this.cancelInFlight = null;
    cancel?.();
  }
}
