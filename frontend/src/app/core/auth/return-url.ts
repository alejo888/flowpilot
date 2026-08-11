/**
 * Pure `returnUrl` allow-list (spec: return-URL preservation and open-redirect
 * prevention; design D4 — threat matrix "SPA redirect target"). Only a
 * single-leading-slash relative path is accepted; anything else — a
 * protocol-relative URL (`//`), a backslash-prefixed value (`/\`), an
 * absolute URL, a scheme like `javascript:`, or an empty/absent value —
 * resolves to `null` so the caller can fall back to `''`.
 */
export function sanitizeReturnUrl(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return null;
  }

  return raw;
}
