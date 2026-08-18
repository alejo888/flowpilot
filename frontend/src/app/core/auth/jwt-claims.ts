import { GlobalRole } from './auth.model';

const RECOGNIZED_ROLES: ReadonlySet<GlobalRole> = new Set(['ADMINISTRADOR', 'MIEMBRO_EQUIPO']);

/**
 * Pure JWT payload decoder (spec: JWT role claim derivation; design D6 —
 * fail-closed decoding). Never throws: any malformed or missing input
 * resolves to `null`, which downstream `isAdmin` treats as non-admin.
 * Decodes via `TextDecoder` over the `atob` byte string (not raw `atob`)
 * because the payload may carry non-ASCII characters (e.g. `email`).
 */
export function decodeRole(token: string | null): GlobalRole | null {
  if (!token) {
    return null;
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }

  const payload = decodePayload(segments[1]);
  if (payload === null) {
    return null;
  }

  const role = (payload as { role?: unknown }).role;
  return typeof role === 'string' && RECOGNIZED_ROLES.has(role as GlobalRole)
    ? (role as GlobalRole)
    : null;
}

/**
 * Decodes the numeric user id from the JWT `sub` claim (design D5). Fail-closed:
 * returns `null` unless `sub` is a string of digits that parses to a finite
 * number — matching {@link decodeRole}'s documented contract.
 */
export function decodeUserId(token: string | null): number | null {
  if (!token) {
    return null;
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }

  const payload = decodePayload(segments[1]);
  if (payload === null) {
    return null;
  }

  const sub = (payload as { sub?: unknown }).sub;
  if (typeof sub !== 'string' || !/^\d+$/.test(sub)) {
    return null;
  }

  const userId = Number(sub);
  return Number.isFinite(userId) ? userId : null;
}

/**
 * Decodes the `email` claim from the JWT payload (design D4 — sidebar user
 * footer identity; backend `JwtService` already sets this claim). Fail-closed
 * like {@link decodeRole}/{@link decodeUserId}: any malformed input, missing
 * claim, or non-string claim resolves to `null`.
 */
export function decodeEmail(token: string | null): string | null {
  if (!token) {
    return null;
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }

  const payload = decodePayload(segments[1]);
  if (payload === null) {
    return null;
  }

  const email = (payload as { email?: unknown }).email;
  return typeof email === 'string' ? email : null;
}

function decodePayload(base64url: string): unknown {
  try {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
