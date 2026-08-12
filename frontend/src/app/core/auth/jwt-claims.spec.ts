import { decodeRole, decodeUserId } from './jwt-claims';

/** Builds a syntactically valid JWT string from a header/payload pair. */
function makeToken(payload: unknown, header: unknown = { alg: 'HS256', typ: 'JWT' }): string {
  const encode = (value: unknown): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  return `${encode(header)}.${encode(payload)}.signature`;
}

describe('decodeRole', () => {
  it('returns the role claim from a valid token payload', () => {
    const token = makeToken({ sub: 'user@flowpilot.local', role: 'ADMINISTRADOR' });

    expect(decodeRole(token)).toBe('ADMINISTRADOR');
  });

  it('returns a different role claim when the payload carries MIEMBRO_EQUIPO', () => {
    const token = makeToken({ sub: 'user@flowpilot.local', role: 'MIEMBRO_EQUIPO' });

    expect(decodeRole(token)).toBe('MIEMBRO_EQUIPO');
  });

  it('returns null when the token has the wrong number of segments', () => {
    expect(decodeRole('only-one-segment')).toBeNull();
  });

  it('returns null when the payload segment is not valid base64url', () => {
    expect(decodeRole('header.***not-base64url***.signature')).toBeNull();
  });

  it('returns null when the decoded payload is not valid JSON', () => {
    const notJson = btoa('not-json-at-all').replace(/\+/g, '-').replace(/\//g, '_');

    expect(decodeRole(`header.${notJson}.signature`)).toBeNull();
  });

  it('returns null when the payload has no role claim', () => {
    const token = makeToken({ sub: 'user@flowpilot.local' });

    expect(decodeRole(token)).toBeNull();
  });

  it('returns null when the role claim is not a recognized role', () => {
    const token = makeToken({ sub: 'user@flowpilot.local', role: 'SUPERUSER' });

    expect(decodeRole(token)).toBeNull();
  });

  it('returns null when the token is null', () => {
    expect(decodeRole(null)).toBeNull();
  });

  it('decodes a payload containing non-ASCII characters via TextDecoder', () => {
    const token = makeToken({ sub: 'josé@flowpilot.local', role: 'ADMINISTRADOR' });

    expect(decodeRole(token)).toBe('ADMINISTRADOR');
  });
});

describe('decodeUserId', () => {
  it('returns the numeric user id from a valid token payload', () => {
    const token = makeToken({ sub: '42', role: 'ADMINISTRADOR' });

    expect(decodeUserId(token)).toBe(42);
  });

  it('returns null when the sub claim is missing', () => {
    const token = makeToken({ role: 'ADMINISTRADOR' });

    expect(decodeUserId(token)).toBeNull();
  });

  it('returns null when the sub claim is not numeric', () => {
    const token = makeToken({ sub: 'user@flowpilot.local', role: 'ADMINISTRADOR' });

    expect(decodeUserId(token)).toBeNull();
  });

  it('returns null when the token is malformed', () => {
    expect(decodeUserId('only-one-segment')).toBeNull();
  });

  it('returns null when the token is null', () => {
    expect(decodeUserId(null)).toBeNull();
  });
});
