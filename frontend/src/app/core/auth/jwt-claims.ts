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
