import { WritableSignal } from '@angular/core';
import { Observable, TimeoutError, timeout } from 'rxjs';

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

/** Construction-time behaviour of a {@link LatestRequest}. */
export interface LatestRequestConfig {
  /**
   * Whether dropping a run unsubscribes its source (default `true`). Pass
   * `false` for non-idempotent writes so a dropped POST still reaches the
   * server instead of being cancelled at an unknown point.
   */
  cancelOnDrop?: boolean;
  /**
   * Abandons a run that produced no value within `ms`: busy clears, the promise
   * resolves `false` and the error signal gets `message` (bypassing `fallback`
   * and `onError`). Omit for no timeout.
   */
  timeout?: { ms: number; message: string };
}

/** Client-side deadline for non-idempotent AI confirm POSTs (HttpClient has none of its own). */
export const CONFIRM_TIMEOUT_MS = 30_000;

/**
 * Token-guarded Observable -> `Promise<boolean>` bridge for signals stores.
 *
 * Owns one generation counter: every {@link run} and {@link invalidate} bumps
 * it, and a response only lands while its token still matches. A stale
 * (superseded or invalidated) response resolves `false` and touches no state,
 * so a late reply can never leak a draft, error or busy flag into a newer
 * request, another item or another project.
 *
 * Dropping a run (via {@link invalidate} or a newer {@link run}) resolves the
 * dropped run's promise `false` and, by default, unsubscribes its source so the
 * underlying HTTP request is cancelled instead of running on unobserved. With
 * `cancelOnDrop: false` the source is left subscribed: the request runs to
 * completion unobserved and its eventual response still touches no state.
 *
 * {@link invalidate} also clears the busy signal: the dropped request will
 * never clear it itself. The error signal stays the caller's to manage.
 *
 * With a configured `timeout`, a run that produced no value in time is
 * abandoned: rxjs `timeout` unsubscribes the source, so its response can no
 * longer land, and the run settles like a failure carrying the timeout
 * message. It is the one case where even a `cancelOnDrop: false` write is
 * given up on (otherwise a hung request would keep busy set forever), so for a
 * non-idempotent write the message should warn that the request may still have
 * succeeded server-side and must be checked before retrying. The deadline only
 * acts through the same token guard: a dropped or superseded run that times
 * out touches no state.
 */
export class LatestRequest {
  private generation = 0;
  /** Drops the pending run (resolve `false`, unsubscribe unless kept); null once it settled or was dropped. */
  private cancelInFlight: (() => void) | null = null;

  constructor(
    private readonly busy: WritableSignal<boolean>,
    private readonly error: WritableSignal<string | null>,
    private readonly config: LatestRequestConfig = {},
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

      const timed = this.config.timeout ? source.pipe(timeout(this.config.timeout.ms)) : source;
      const subscription = timed.subscribe({
        next: (value) => settle(() => options.onSuccess(value), true),
        error: (err: unknown) =>
          settle(() => {
            if (err instanceof TimeoutError && this.config.timeout) {
              this.error.set(this.config.timeout.message);
            } else if ('onError' in options) {
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
          if (this.config.cancelOnDrop ?? true) {
            subscription.unsubscribe();
          }
          resolve(false);
        };
      }
    });
  }

  /** Drops any in-flight run (resolves it `false`, unsubscribes it unless `cancelOnDrop` is false) and clears busy. */
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
