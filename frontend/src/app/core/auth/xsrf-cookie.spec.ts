import { readCookie, xsrfHeader } from './xsrf-cookie';

describe('readCookie', () => {
  it('returns null for an empty cookie string', () => {
    expect(readCookie('XSRF-TOKEN', '')).toBeNull();
  });

  it('reads the value from a single cookie', () => {
    expect(readCookie('XSRF-TOKEN', 'XSRF-TOKEN=abc123')).toBe('abc123');
  });

  it('reads the target cookie out of multiple cookies', () => {
    expect(readCookie('XSRF-TOKEN', 'foo=bar; XSRF-TOKEN=abc123; baz=qux')).toBe('abc123');
  });

  it('trims surrounding whitespace around cookie pairs', () => {
    expect(readCookie('XSRF-TOKEN', ' foo=bar;   XSRF-TOKEN=abc123 ; baz=qux ')).toBe('abc123');
  });

  it('preserves an "=" character inside the cookie value', () => {
    expect(readCookie('XSRF-TOKEN', 'XSRF-TOKEN=abc=123==')).toBe('abc=123==');
  });

  it('returns null when the cookie is missing', () => {
    expect(readCookie('XSRF-TOKEN', 'foo=bar; baz=qux')).toBeNull();
  });
});

describe('xsrfHeader', () => {
  it('returns the X-XSRF-TOKEN header when the cookie is present', () => {
    const doc = { cookie: 'XSRF-TOKEN=abc123' } as Document;

    expect(xsrfHeader(doc)).toEqual({ 'X-XSRF-TOKEN': 'abc123' });
  });

  it('returns an empty object when the cookie is absent', () => {
    const doc = { cookie: 'foo=bar' } as Document;

    expect(xsrfHeader(doc)).toEqual({});
  });
});
