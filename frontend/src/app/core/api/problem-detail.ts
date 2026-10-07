/**
 * Reads the RFC 7807 `detail` the backend sends in an HTTP error body.
 *
 * `HttpErrorResponse` implements `Error` but does not extend it, so
 * `err instanceof Error` is false for real HTTP failures; the Spanish
 * message lives in `err.error.detail` instead. Returns `fallback` when the
 * error has no body or the detail is missing, empty, or not a string.
 */
export function problemDetail(err: unknown, fallback: string): string {
  const detail = (err as { error?: { detail?: unknown } } | null | undefined)?.error?.detail;
  return typeof detail === 'string' && detail.length > 0 ? detail : fallback;
}
