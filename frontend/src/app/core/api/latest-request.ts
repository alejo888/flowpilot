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
 * {@link invalidate} also clears the busy signal: the dropped request will
 * never clear it itself. The error signal stays the caller's to manage.
 */
export class LatestRequest {
  private generation = 0;

  constructor(
    private readonly busy: WritableSignal<boolean>,
    private readonly error: WritableSignal<string | null>,
  ) {}

  /** Subscribes to `source`; resolves `true` only when its first value landed while still current. */
  run<T>(source: Observable<T>, options: LatestRequestOptions<T>): Promise<boolean> {
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
        apply();
        this.busy.set(false);
        resolve(ok);
      };

      source.subscribe({
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
    });
  }

  /** Drops any in-flight run (its late response is ignored) and clears the busy signal. */
  invalidate(): void {
    this.generation++;
    this.busy.set(false);
  }
}
